/**
 * 星数 = min(max, 答错次数)，下限 0。
 * 只用于展示与筛选：调度函数一律不接收 stars，避免「星数反向影响排序」的隐性耦合（I5）。
 */
export function starsOf(wrongCount: number, max: number = 5): number {
  const cap = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(wrongCount) || wrongCount <= 0) return 0;
  return Math.min(cap, Math.floor(wrongCount));
}
