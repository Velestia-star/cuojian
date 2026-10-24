import { starsOf } from '../core/stars';
import type {
  AttemptRow,
  BlankAnswerRow,
  CardRow,
  NewQuestionInput,
  OptionRow,
  QuestionBundle,
  QuestionRow,
  RoundState,
} from '../types';
import { db } from './db';
import { SETTING_KEYS, type AttemptRecord, type Repository } from './repository';

const newId = (): string => crypto.randomUUID();

function emptyCard(questionId: string): CardRow {
  // 未练过：0 星、不在历史里，但默认在池中
  return {
    questionId,
    wrongCount: 0,
    stars: 0,
    lastResult: null,
    lastSeenAt: null,
    inQueue: true,
  };
}

/** Dexie 实现：所有写法都走事务，避免「题写进去了选项没写进去」。 */
export class DexieRepository implements Repository {
  async listBundles(): Promise<QuestionBundle[]> {
    return db.transaction(
      'r',
      [db.question, db.option, db.answer, db.card],
      async () => {
        const [questions, options, blanks, cards] = await Promise.all([
          db.question.toArray(),
          db.option.toArray(),
          db.answer.toArray(),
          db.card.toArray(),
        ]);
        const groups = groupByQuestion(options, blanks, cards);
        return questions
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((question) => toBundle(question, groups));
      },
    );
  }

  async getBundle(id: string): Promise<QuestionBundle | null> {
    return db.transaction(
      'r',
      [db.question, db.option, db.answer, db.card],
      async () => {
        const question = await db.question.get(id);
        if (!question) return null;
        const [options, blanks, card] = await Promise.all([
          db.option.where('questionId').equals(id).toArray(),
          db.answer.where('questionId').equals(id).toArray(),
          db.card.get(id),
        ]);
        return toBundle(question, {
          options: new Map([[id, options]]),
          blanks: new Map([[id, blanks]]),
          cards: new Map(card ? [[id, card]] : []),
        });
      },
    );
  }

  async createQuestion(
    input: NewQuestionInput,
    now: number,
  ): Promise<QuestionBundle> {
    const questionId = newId();
    const question: QuestionRow = {
      id: questionId,
      kind: input.kind,
      stem: input.stem,
      explanation: input.explanation,
      subject: input.subject,
      difficulty: input.difficulty,
      multi: input.kind === 'choice' ? input.multi : false,
      shuffleLocked: input.shuffleLocked,
      blankStrict: input.blankStrict,
      ignoreCase: input.ignoreCase,
      revision: 1,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    // 选项 id 由题目 id 派生：稳定、可读，导入导出不会撞车
    const options: OptionRow[] =
      input.kind === 'choice'
        ? input.options.map((o, i) => ({
            id: `${questionId}-o${i + 1}`,
            questionId,
            ord: i,
            text: o.text,
            isCorrect: o.isCorrect,
            positional: o.positional,
            deletedAt: null,
          }))
        : [];
    const blanks: BlankAnswerRow[] =
      input.kind === 'blank'
        ? input.blanks.flatMap((b, i) =>
            b.accepts.map((text, n) => ({
              id: `${questionId}-b${i + 1}-a${n + 1}`,
              questionId,
              blankIndex: i,
              text,
            })),
          )
        : [];
    const card = emptyCard(questionId);

    await db.transaction(
      'rw',
      [db.question, db.option, db.answer, db.card],
      async () => {
        await db.question.add(question);
        if (options.length > 0) await db.option.bulkAdd(options);
        if (blanks.length > 0) await db.answer.bulkAdd(blanks);
        await db.card.add(card);
      },
    );
    return { question, options, blanks, card };
  }

  async archiveQuestion(id: string, now: number): Promise<void> {
    await db.transaction('rw', [db.question, db.card], async () => {
      const question = await db.question.get(id);
      if (!question) return;
      await db.question.put({
        ...question,
        archivedAt: now,
        updatedAt: now,
        revision: question.revision + 1,
      });
      const card = (await db.card.get(id)) ?? emptyCard(id);
      await db.card.put({ ...card, inQueue: false });
    });
  }

  async restoreQuestion(id: string, now: number): Promise<void> {
    await db.transaction('rw', [db.question, db.card], async () => {
      const question = await db.question.get(id);
      if (!question) return;
      await db.question.put({
        ...question,
        archivedAt: null,
        updatedAt: now,
        revision: question.revision + 1,
      });
      const card = (await db.card.get(id)) ?? emptyCard(id);
      await db.card.put({ ...card, inQueue: true });
    });
  }

  async appendAttempt(record: AttemptRecord, now: number): Promise<void> {
    await db.transaction('rw', [db.attempt, db.card], async () => {
      const attempt: AttemptRow = {
        id: newId(),
        questionId: record.questionId,
        sessionId: record.sessionId,
        isCorrect: record.isCorrect,
        userAnswer: record.userAnswer,
        durationMs: record.durationMs,
        createdAt: now,
        graderVersion: record.graderVersion,
      };
      await db.attempt.add(attempt);
      const card = (await db.card.get(record.questionId)) ?? emptyCard(record.questionId);
      // 星数只由 attempt 推导（R11），答对不降星
      const wrongCount = card.wrongCount + (record.isCorrect ? 0 : 1);
      await db.card.put({
        ...card,
        wrongCount,
        stars: starsOf(wrongCount),
        lastResult: record.isCorrect ? 'right' : 'wrong',
        lastSeenAt: now,
      });
    });
  }

  async listAttempts(questionId: string): Promise<AttemptRow[]> {
    return db.attempt.where('questionId').equals(questionId).toArray();
  }

  async createSession(id: string, now: number): Promise<void> {
    await db.session.add({ id, startedAt: now, endedAt: null, total: 0, correct: 0 });
  }

  async finishSession(
    id: string,
    now: number,
    total: number,
    correct: number,
  ): Promise<void> {
    const session = await db.session.get(id);
    if (!session) return;
    await db.session.put({ ...session, endedAt: now, total, correct });
  }

  async saveRound(round: RoundState): Promise<void> {
    await db.transaction('rw', [db.queue_item, db.setting], async () => {
      await db.queue_item.clear();
      await db.queue_item.bulkPut(
        round.pending.map((questionId, pos) => ({ questionId, pos })),
      );
      await db.setting.put({
        key: SETTING_KEYS.activeRound,
        value: JSON.stringify({ ...round, pending: [] }),
      });
    });
  }

  async loadRound(): Promise<RoundState | null> {
    return db.transaction('r', [db.queue_item, db.setting], async () => {
      const row = await db.setting.get(SETTING_KEYS.activeRound);
      if (!row) return null;
      const parsed = JSON.parse(row.value) as Omit<RoundState, 'pending'>;
      const items = await db.queue_item.toArray();
      const pending = items.sort((a, b) => a.pos - b.pos).map((i) => i.questionId);
      return { ...parsed, pending };
    });
  }

  async clearRound(): Promise<void> {
    await db.transaction('rw', [db.queue_item, db.setting], async () => {
      await db.queue_item.clear();
      await db.setting.delete(SETTING_KEYS.activeRound);
    });
  }
}

interface Groups {
  options: Map<string, OptionRow[]>;
  blanks: Map<string, BlankAnswerRow[]>;
  cards: Map<string, CardRow>;
}

function groupByQuestion(
  options: OptionRow[],
  blanks: BlankAnswerRow[],
  cards: CardRow[],
): Groups {
  const groups: Groups = {
    options: new Map(),
    blanks: new Map(),
    cards: new Map(cards.map((c) => [c.questionId, c])),
  };
  for (const option of options) {
    const list = groups.options.get(option.questionId) ?? [];
    list.push(option);
    groups.options.set(option.questionId, list);
  }
  for (const blank of blanks) {
    const list = groups.blanks.get(blank.questionId) ?? [];
    list.push(blank);
    groups.blanks.set(blank.questionId, list);
  }
  return groups;
}

function toBundle(question: QuestionRow, groups: Groups): QuestionBundle {
  return {
    question,
    options: (groups.options.get(question.id) ?? []).sort((a, b) => a.ord - b.ord),
    blanks: (groups.blanks.get(question.id) ?? []).sort(
      (a, b) => a.blankIndex - b.blankIndex,
    ),
    card: groups.cards.get(question.id) ?? emptyCard(question.id),
  };
}
