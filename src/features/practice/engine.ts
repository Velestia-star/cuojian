import type { Rng } from '../../core/rng';
import { reinsert } from '../../core/scheduler';
import { shuffle } from '../../core/shuffle';
import type { RoundState } from '../../types';

/** R13：单轮上限。到线就进结算，避免 A 模型下永远刷不完。 */
export const MAX_PER_ROUND = 50;

/** 开新一轮：整池打乱一次，之后只靠重插维护顺序（R12 恢复的也是这个顺序）。 */
export function startRound(
  poolIds: readonly string[],
  rng: Rng,
  now: number,
  sessionId: string,
): RoundState {
  const unique = Array.from(new Set(poolIds));
  const pending = shuffle(unique, rng).slice(0, MAX_PER_ROUND);
  return {
    sessionId,
    pending,
    served: 0,
    total: pending.length,
    correct: 0,
    startedAt: now,
    pendingChoice: null,
    finishedAt: pending.length === 0 ? now : null,
  };
}

/** pending[0] 恒为当前题；取题不修改队列。 */
export function currentQuestionId(round: RoundState): string | null {
  return round.pending[0] ?? null;
}

/**
 * 进度口径：已作答 / (已作答 + 还在队列里 + 正在等二选一的那道)。
 * 用移动分母而不是固定题数，是因为 A 模型下重插会让题目总数变化，固定分母会算歪。
 */
export function progressOf(round: RoundState): { served: number; total: number } {
  return {
    served: round.served,
    total: round.served + round.pending.length + (round.pendingChoice ? 1 : 0),
  };
}

export function isRoundOver(round: RoundState): boolean {
  return round.finishedAt !== null;
}

/** 答错：R5 —— 计错、重新排队、不弹窗。 */
export function applyWrong(round: RoundState, rng: Rng, now: number): RoundState {
  const id = currentQuestionId(round);
  if (id === null) return round;
  const pending = reinsert(round.pending.slice(1), id, rng);
  const served = round.served + 1;
  return finishIfNeeded({ ...round, pending, served }, now);
}

/** 答对第一步：R6 —— 先把题取走，等用户选保留还是划去。 */
export function applyCorrect(round: RoundState, now: number): RoundState {
  const id = currentQuestionId(round);
  if (id === null) return round;
  return {
    ...round,
    pending: round.pending.slice(1),
    served: round.served + 1,
    correct: round.correct + 1,
    pendingChoice: { questionId: id, askedAt: now },
  };
}

/** 答对 + 保留：重新排队（同样受冷却与尾部窗口约束）。 */
export function applyKeep(round: RoundState, rng: Rng, now: number): RoundState {
  const choice = round.pendingChoice;
  if (!choice) return round;
  const pending = reinsert(round.pending, choice.questionId, rng);
  return finishIfNeeded({ ...round, pending, pendingChoice: null }, now);
}

/** 答对 + 划去：只从队列移除，软删除由 Repository 落库。 */
export function applyArchive(round: RoundState, now: number): RoundState {
  if (!round.pendingChoice) return round;
  return finishIfNeeded({ ...round, pendingChoice: null }, now);
}

/**
 * R15：进程被杀时用户还没选，恢复时默认按「保留」落库。
 * 这不是兜底代码，是规则本身。
 */
export function resumeChoiceAsKeep(round: RoundState, rng: Rng, now: number): RoundState {
  return round.pendingChoice ? applyKeep(round, rng, now) : round;
}

/** 用户点「结束本轮」。 */
export function endRoundByUser(round: RoundState, now: number): RoundState {
  return round.finishedAt !== null ? round : { ...round, finishedAt: now };
}

function finishIfNeeded(round: RoundState, now: number): RoundState {
  if (round.pending.length === 0 || round.served >= MAX_PER_ROUND) {
    return { ...round, finishedAt: now };
  }
  return round;
}
