import { createStore } from 'zustand/vanilla';
import { gradeBlank, gradeChoice } from '../core/grade';
import type { Rng } from '../core/rng';
import { reinsert } from '../core/scheduler';
import { shuffleOptions } from '../core/shuffle';
import type { Repository } from '../db/repository';
import {
  applyArchive,
  applyCorrect,
  applyKeep,
  applyWrong,
  currentQuestionId,
  endRoundByUser,
  isRoundOver,
  resumeChoiceAsKeep,
  startRound,
} from '../features/practice/engine';
import type { NewQuestionInput, QuestionBundle, RoundState } from '../types';

/** R10 判定规则版本：规则一改就 +1，历史 attempt 不会被追溯推翻。 */
const GRADER_VERSION = 1;
/** R15：划去后 5 秒内可撤销 */
export const UNDO_WINDOW_MS = 5000;

export interface AppDeps {
  repo: Repository;
  rng: Rng;
  now: () => number;
  newId: () => string;
}

export interface AnswerFeedback {
  isCorrect: boolean;
  /** 正确答案怎么念（选择题用渲染后的字母，绝不写死 A/B） */
  correctText: string;
  userText: string;
}

export interface AppState {
  ready: boolean;
  bootError: string | null;
  questions: QuestionBundle[];
  round: RoundState | null;
  sessionFinished: boolean;
  viewQuestionId: string | null;
  /** 每次进入作答态 +1：同一道题再次出现时用它重挂作答组件 */
  viewNonce: number;
  /** R3：本次作答的选项渲染顺序（option id），只在进入作答态时算一次 */
  renderedOptionIds: string[];
  pickedOptionIds: string[];
  blankInputs: string[];
  shownAt: number;
  feedback: AnswerFeedback | null;
  undo: { questionId: string; expiresAt: number } | null;
  busy: boolean;

  init: () => Promise<void>;
  reloadQuestions: () => Promise<void>;
  startPractice: () => Promise<void>;
  answerChoice: (pickedIds: readonly string[]) => Promise<void>;
  answerBlank: (values: readonly string[]) => Promise<void>;
  nextQuestion: () => void;
  chooseKeep: () => Promise<void>;
  chooseArchive: () => Promise<void>;
  undoArchive: () => Promise<void>;
  clearUndo: () => void;
  finishRound: () => Promise<void>;
  createQuestion: (input: NewQuestionInput) => Promise<string>;
  archiveQuestion: (questionId: string) => Promise<void>;
  restoreQuestion: (questionId: string) => Promise<void>;
}

export type AppStore = ReturnType<typeof createAppStore>;

export function createAppStore(deps: AppDeps) {
  return createStore<AppState>()((set, get) => {
    const findBundle = (id: string): QuestionBundle | undefined =>
      get().questions.find((b) => b.question.id === id);

    const commitRound = async (next: RoundState): Promise<void> => {
      set({ round: next });
      await deps.repo.saveRound(next);
      if (next.finishedAt !== null && !get().sessionFinished) {
        await deps.repo.finishSession(
          next.sessionId,
          next.finishedAt,
          next.served,
          next.correct,
        );
        set({ sessionFinished: true });
      }
    };

    const showQuestion = (questionId: string): void => {
      const bundle = findBundle(questionId);
      if (!bundle) {
        set({ viewQuestionId: null, renderedOptionIds: [], feedback: null });
        return;
      }
      const rendered = shuffleOptions(
        bundle.options.filter((o) => o.deletedAt === null),
        bundle.question.shuffleLocked,
        deps.rng,
      ).map((o) => o.id);
      set({
        viewQuestionId: questionId,
        viewNonce: get().viewNonce + 1,
        renderedOptionIds: rendered,
        pickedOptionIds: [],
        blankInputs: blankCountOf(bundle).map(() => ''),
        shownAt: deps.now(),
        feedback: null,
      });
    };

    const recordAttempt = async (
      bundle: QuestionBundle,
      sessionId: string,
      isCorrect: boolean,
      userAnswer: string,
    ): Promise<void> => {
      const at = deps.now();
      await deps.repo.appendAttempt(
        {
          questionId: bundle.question.id,
          sessionId,
          isCorrect,
          userAnswer,
          durationMs: Math.max(0, at - get().shownAt),
          graderVersion: GRADER_VERSION,
        },
        at,
      );
    };

    const advanceView = (round: RoundState): void => {
      if (isRoundOver(round)) {
        set({ viewQuestionId: null, renderedOptionIds: [], feedback: null });
        return;
      }
      const id = currentQuestionId(round);
      if (id === null) {
        set({ viewQuestionId: null, renderedOptionIds: [], feedback: null });
        return;
      }
      showQuestion(id);
    };

    return {
      ready: false,
      bootError: null,
      questions: [],
      round: null,
      sessionFinished: false,
      viewQuestionId: null,
      viewNonce: 0,
      renderedOptionIds: [],
      pickedOptionIds: [],
      blankInputs: [],
      shownAt: 0,
      feedback: null,
      undo: null,
      busy: false,

      async init() {
        try {
          const questions = await deps.repo.listBundles();
          const restored = await deps.repo.loadRound();
          let round: RoundState | null = null;
          let sessionFinished = false;
          if (restored) {
            // 自愈：已划去/已不存在的题不该留在队列里
            const alive = new Set(
              questions
                .filter((b) => b.question.archivedAt === null)
                .map((b) => b.question.id),
            );
            const pruned: RoundState = {
              ...restored,
              pending: restored.pending.filter((id) => alive.has(id)),
              pendingChoice:
                restored.pendingChoice && alive.has(restored.pendingChoice.questionId)
                  ? restored.pendingChoice
                  : null,
            };
            // R15：没选就退出/被杀的，恢复时按「保留」落库
            const resolved = resumeChoiceAsKeep(pruned, deps.rng, deps.now());
            const finished: RoundState =
              resolved.pending.length === 0
                ? { ...resolved, finishedAt: deps.now() }
                : resolved;
            round = finished;
            sessionFinished = finished.finishedAt !== null;
          }
          set({ questions, round, sessionFinished, ready: true });
          if (round) {
            await deps.repo.saveRound(round);
            if (!sessionFinished) advanceView(round);
          }
        } catch (error) {
          set({ ready: true, bootError: messageOf(error) });
        }
      },

      async reloadQuestions() {
        const questions = await deps.repo.listBundles();
        set({ questions });
      },

      async startPractice() {
        const pool = get()
          .questions.filter((b) => b.question.archivedAt === null)
          .map((b) => b.question.id);
        if (pool.length === 0) return;
        const at = deps.now();
        const sessionId = deps.newId();
        await deps.repo.createSession(sessionId, at);
        const round = startRound(pool, deps.rng, at, sessionId);
        set({ sessionFinished: false, undo: null, feedback: null, busy: true });
        await commitRound(round);
        set({ busy: false });
        advanceView(round);
      },

      async answerChoice(pickedIds) {
        const { round, viewQuestionId, feedback } = get();
        if (!round || !viewQuestionId || feedback || pickedIds.length === 0) return;
        const bundle = findBundle(viewQuestionId);
        if (!bundle) return;
        const correctIds = bundle.options
          .filter((o) => o.isCorrect && o.deletedAt === null)
          .map((o) => o.id);
        const isCorrect = gradeChoice(correctIds, pickedIds);
        await recordAttempt(bundle, round.sessionId, isCorrect, JSON.stringify([...pickedIds]));
        const rendered = get().renderedOptionIds;
        const correctText = correctIds
          .slice()
          .sort((a, b) => rendered.indexOf(a) - rendered.indexOf(b))
          .map((id) => {
            const letter = letterOf(rendered.indexOf(id));
            const text = bundle.options.find((o) => o.id === id)?.text ?? '';
            return `${letter}. ${text}`;
          })
          .join('；');
        const userText = [...pickedIds]
          .sort((a, b) => rendered.indexOf(a) - rendered.indexOf(b))
          .map((id) => letterOf(rendered.indexOf(id)))
          .join('、');
        const at = deps.now();
        set({
          pickedOptionIds: [...pickedIds],
          feedback: { isCorrect, correctText, userText },
        });
        const next = isCorrect
          ? applyCorrect(round, at)
          : applyWrong(round, deps.rng, at);
        await commitRound(next);
        await get().reloadQuestions();
      },

      async answerBlank(values) {
        const { round, viewQuestionId, feedback } = get();
        if (!round || !viewQuestionId || feedback) return;
        const bundle = findBundle(viewQuestionId);
        if (!bundle) return;
        const groups = blanksByIndex(bundle);
        const isCorrect = groups.every((accepts, i) =>
          gradeBlank(
            accepts,
            values[i] ?? '',
            bundle.question.blankStrict,
            bundle.question.ignoreCase,
          ),
        );
        await recordAttempt(bundle, round.sessionId, isCorrect, JSON.stringify(values));
        const correctText = groups
          .map((accepts, i) => `(${i + 1}) ${accepts.join(' / ')}`)
          .join('；');
        const at = deps.now();
        set({
          blankInputs: [...values],
          feedback: {
            isCorrect,
            correctText,
            userText: values.map((v) => v.trim()).join('；'),
          },
        });
        const next = isCorrect
          ? applyCorrect(round, at)
          : applyWrong(round, deps.rng, at);
        await commitRound(next);
        await get().reloadQuestions();
      },

      nextQuestion() {
        const { round } = get();
        if (!round) return;
        // 答对后等二选一：此时不能自己往下走
        if (round.pendingChoice) return;
        advanceView(round);
      },

      async chooseKeep() {
        const round = get().round;
        if (!round?.pendingChoice) return;
        const next = applyKeep(round, deps.rng, deps.now());
        await commitRound(next);
        advanceView(next);
      },

      async chooseArchive() {
        const round = get().round;
        if (!round?.pendingChoice) return;
        const questionId = round.pendingChoice.questionId;
        const at = deps.now();
        const next = applyArchive(round, at);
        await deps.repo.archiveQuestion(questionId, at);
        await commitRound(next);
        set({ undo: { questionId, expiresAt: at + UNDO_WINDOW_MS } });
        advanceView(next);
        await get().reloadQuestions();
      },

      async undoArchive() {
        const undo = get().undo;
        if (!undo) return;
        const at = deps.now();
        // 过期后不再撤销，也不报错：按钮已经消失了
        if (at > undo.expiresAt) {
          set({ undo: null });
          return;
        }
        await deps.repo.restoreQuestion(undo.questionId, at);
        const round = get().round;
        if (round && !isRoundOver(round)) {
          const pending = reinsert(round.pending, undo.questionId, deps.rng);
          await commitRound({ ...round, pending });
        }
        set({ undo: null });
        await get().reloadQuestions();
      },

      clearUndo() {
        set({ undo: null });
      },

      async finishRound() {
        const round = get().round;
        if (!round) return;
        const next = endRoundByUser(round, deps.now());
        await commitRound(next);
      },

      async createQuestion(input) {
        const bundle = await deps.repo.createQuestion(input, deps.now());
        await get().reloadQuestions();
        return bundle.question.id;
      },

      async archiveQuestion(questionId) {
        await deps.repo.archiveQuestion(questionId, deps.now());
        const round = get().round;
        // 在池外被划去的题，如果还挂在当前队列里，顺手摘掉，避免出一张已归档的题
        if (round && round.pending.includes(questionId)) {
          const pending = round.pending.filter((id) => id !== questionId);
          const next: RoundState =
            pending.length === 0 && !round.pendingChoice
              ? { ...round, pending, finishedAt: deps.now() }
              : { ...round, pending };
          await commitRound(next);
          // 划掉的正好是屏幕上这道题，就顺势切到下一道，别让用户对着已归档的题作答
          if (get().viewQuestionId === questionId) advanceView(next);
        }
        await get().reloadQuestions();
      },

      async restoreQuestion(questionId) {
        await deps.repo.restoreQuestion(questionId, deps.now());
        await get().reloadQuestions();
      },
    };
  });
}

/** 字母是渲染产物（R2）：只按当前顺序算，任何地方都不持久化。 */
export function letterOf(index: number): string {
  if (index < 0) return '?';
  return String.fromCharCode(65 + index);
}

/** 空的数量按最大 blankIndex 推，不依赖「每空答案条数一致」。 */
export function blankCountOf(bundle: QuestionBundle): number[] {
  const groups = blanksByIndex(bundle);
  const count = groups.length === 0 ? 1 : groups.length;
  return Array.from({ length: count }, (_, i) => i);
}

export function blanksByIndex(bundle: QuestionBundle): string[][] {
  const groups: string[][] = [];
  for (const row of bundle.blanks) {
    const index = row.blankIndex;
    groups[index] = [...(groups[index] ?? []), row.text];
  }
  return groups.map((g) => g ?? []);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
