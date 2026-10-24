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
import type { AttemptRecord, Repository } from './repository';

let seq = 0;
const nextId = (prefix: string): string => `${prefix}-${++seq}`;

/**
 * 内存实现：给 store/engine 的单测用。行为必须和 DexieRepository 一致，
 * 否则测试会变成「测了个假的」。
 */
export class MemoryRepository implements Repository {
  private questions = new Map<string, QuestionRow>();
  private options = new Map<string, OptionRow[]>(); // 按 questionId
  private blanks = new Map<string, BlankAnswerRow[]>();
  private cards = new Map<string, CardRow>();
  private attempts: AttemptRow[] = [];
  private sessions = new Map<string, { id: string; startedAt: number; endedAt: number | null; total: number; correct: number }>();
  private round: RoundState | null = null;

  async listBundles(): Promise<QuestionBundle[]> {
    return [...this.questions.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((q) => this.bundleOf(q));
  }

  async getBundle(id: string): Promise<QuestionBundle | null> {
    const q = this.questions.get(id);
    return q ? this.bundleOf(q) : null;
  }

  async createQuestion(input: NewQuestionInput, now: number): Promise<QuestionBundle> {
    const id = nextId('q');
    const question: QuestionRow = {
      id,
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
    this.questions.set(id, question);
    this.options.set(
      id,
      input.kind === 'choice'
        ? input.options.map((o, i) => ({
            id: `${id}-o${i + 1}`,
            questionId: id,
            ord: i,
            text: o.text,
            isCorrect: o.isCorrect,
            positional: o.positional,
            deletedAt: null,
          }))
        : [],
    );
    this.blanks.set(
      id,
      input.kind === 'blank'
        ? input.blanks.flatMap((b, i) =>
            b.accepts.map((text, n) => ({
              id: `${id}-b${i + 1}-a${n + 1}`,
              questionId: id,
              blankIndex: i,
              text,
            })),
          )
        : [],
    );
    this.cards.set(id, {
      questionId: id,
      wrongCount: 0,
      stars: 0,
      lastResult: null,
      lastSeenAt: null,
      inQueue: true,
    });
    return this.bundleOf(question);
  }

  async archiveQuestion(id: string, now: number): Promise<void> {
    const q = this.questions.get(id);
    if (!q) return;
    this.questions.set(id, { ...q, archivedAt: now, updatedAt: now, revision: q.revision + 1 });
    const card = this.cards.get(id);
    if (card) this.cards.set(id, { ...card, inQueue: false });
  }

  async restoreQuestion(id: string, now: number): Promise<void> {
    const q = this.questions.get(id);
    if (!q) return;
    this.questions.set(id, { ...q, archivedAt: null, updatedAt: now, revision: q.revision + 1 });
    const card = this.cards.get(id);
    if (card) this.cards.set(id, { ...card, inQueue: true });
  }

  async appendAttempt(record: AttemptRecord, now: number): Promise<void> {
    this.attempts.push({
      id: nextId('a'),
      questionId: record.questionId,
      sessionId: record.sessionId,
      isCorrect: record.isCorrect,
      userAnswer: record.userAnswer,
      durationMs: record.durationMs,
      createdAt: now,
      graderVersion: record.graderVersion,
    });
    const card = this.cards.get(record.questionId);
    if (!card) return;
    const wrongCount = card.wrongCount + (record.isCorrect ? 0 : 1);
    this.cards.set(record.questionId, {
      ...card,
      wrongCount,
      stars: starsOf(wrongCount),
      lastResult: record.isCorrect ? 'right' : 'wrong',
      lastSeenAt: now,
    });
  }

  async listAttempts(questionId: string): Promise<AttemptRow[]> {
    return this.attempts.filter((a) => a.questionId === questionId);
  }

  async createSession(id: string, now: number): Promise<void> {
    this.sessions.set(id, { id, startedAt: now, endedAt: null, total: 0, correct: 0 });
  }

  async finishSession(id: string, now: number, total: number, correct: number): Promise<void> {
    const s = this.sessions.get(id);
    if (!s) return;
    this.sessions.set(id, { ...s, endedAt: now, total, correct });
  }

  async saveRound(round: RoundState): Promise<void> {
    this.round = { ...round, pending: [...round.pending] };
  }

  async loadRound(): Promise<RoundState | null> {
    return this.round ? { ...this.round, pending: [...this.round.pending] } : null;
  }

  async clearRound(): Promise<void> {
    this.round = null;
  }

  private bundleOf(q: QuestionRow): QuestionBundle {
    return {
      question: q,
      options: [...(this.options.get(q.id) ?? [])].sort((a, b) => a.ord - b.ord),
      blanks: [...(this.blanks.get(q.id) ?? [])].sort((a, b) => a.blankIndex - b.blankIndex),
      card: this.cards.get(q.id) ?? {
        questionId: q.id,
        wrongCount: 0,
        stars: 0,
        lastResult: null,
        lastSeenAt: null,
        inQueue: true,
      },
    };
  }
}
