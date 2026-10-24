import type { Rng } from './rng';

/** 队列节奏参数。绝对值兜底小池子，比例值让节奏随题量伸缩。 */
export interface QueueConfig {
  minGapAbs: number;
  minGapRatio: number;
  tailWindowAbs: number;
  tailWindowRatio: number;
}

export const DEFAULT_QUEUE: QueueConfig = {
  minGapAbs: 5,
  minGapRatio: 0.15,
  tailWindowAbs: 3,
  tailWindowRatio: 0.25,
};

/** 剩余题数只接受非负整数；脏输入按 0 处理，避免 NaN 污染比较。 */
function normalizeCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/** 冷却步数：max(5, ceil(0.15 × 剩余题数))，答错后至少隔这么多道才会再见到。 */
export function gapFor(remaining: number, cfg: QueueConfig = DEFAULT_QUEUE): number {
  const n = normalizeCount(remaining);
  return Math.max(normalizeCount(cfg.minGapAbs), Math.ceil(cfg.minGapRatio * n));
}

/** 尾部窗口：max(3, ceil(0.25 × 剩余题数))，重插只落在队尾这一段内。 */
export function windowFor(remaining: number, cfg: QueueConfig = DEFAULT_QUEUE): number {
  const n = normalizeCount(remaining);
  return Math.max(normalizeCount(cfg.tailWindowAbs), Math.ceil(cfg.tailWindowRatio * n));
}

/**
 * 答错（或答对后选择保留）的重插：先从队列移除，再插进尾部窗口内均匀随机的位置。
 * 不修改入参；队列里不会出现重复 id——移除在插入之前。
 * 题目太密集时插入点会被冷却下限顶到队尾，保证「马上又见到」不会发生。
 */
export function reinsert(
  pending: readonly string[],
  questionId: string,
  rng: Rng,
  cfg: QueueConfig = DEFAULT_QUEUE,
): string[] {
  const rest = pending.filter((id) => id !== questionId);
  const n = rest.length;
  // 没有别的题就没有冷却可言，只能立刻再出
  if (n === 0) return [questionId];

  const gap = gapFor(n, cfg);
  const win = windowFor(n, cfg);
  // lo：能插的最靠前位置。既要满足冷却步数，又要落在尾部窗口内；
  // 池子比 gap 还小时取 n，也就是排到队尾。
  const lo = Math.min(n, Math.max(gap, n - win));
  const span = n - lo + 1;
  const offset = Math.min(span - 1, Math.max(0, Math.floor(rng() * span)));
  const pos = lo + offset;
  return [...rest.slice(0, pos), questionId, ...rest.slice(pos)];
}

/** 取下一题：永远队首。签名里没有 stars —— 星数只用于展示/筛选，不参与调度（I5）。 */
export function pickNext(pending: readonly string[]): string | null {
  return pending.length === 0 ? null : pending[0];
}
