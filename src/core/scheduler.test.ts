import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mulberry32, type Rng } from './rng';
import { DEFAULT_QUEUE, gapFor, pickNext, reinsert, windowFor, type QueueConfig } from './scheduler';

/** 规则里的插入下界：冷却与尾部窗口取更靠后的那个；池子不足 gap 时贴到队尾。 */
function lowerBound(n: number): number {
  return Math.min(n, Math.max(gapFor(n), n - windowFor(n)));
}

const QUESTION_COUNT = 60;

function makePool(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `q${String(i).padStart(2, '0')}`);
}

interface SimOptions {
  maxDraws: number;
  rng: Rng;
  /** true = 答对且未保留时移出本轮队列（视为掌握）；false = 一律保留，纯粹压测长跑 */
  allowDrop: boolean;
}

interface SimResult {
  draws: number;
  picked: Set<string>;
  pool: readonly string[];
  checks: number;
  largePoolChecks: number;
  violations: string[];
}

interface Placement {
  draw: number;
  /** 规则要求的最小间隔 min(gap, n)：池子不足 gap 时只能排到队尾 */
  gapNeed: number;
  /** 实现上更紧的下界：插入下标 lo（含尾部窗口） */
  loNeed: number;
  large: boolean;
}

/**
 * 跑一轮队列模拟。口径说明：
 * - 「取走时的剩余数」= 取走队首之后、重插之前队列的长度 n；
 * - 「两次出现的间隔」= 再次取走时的已取序号 - 上次取走序号 - 1（中间被别人取走的次数）；
 * - 只有答错或答对后保留的题会重插，答对且不保留的题（allowDrop 时）离开队列。
 */
function simulate({ maxDraws, rng, allowDrop }: SimOptions): SimResult {
  let pool: readonly string[] = makePool(QUESTION_COUNT);
  const placed = new Map<string, Placement>();
  const picked = new Set<string>();
  const violations: string[] = [];
  let draws = 0;
  let checks = 0;
  let largePoolChecks = 0;

  while (draws < maxDraws && pool.length > 0) {
    const id = pickNext(pool);
    if (id === null) break;
    pool = pool.slice(1);
    draws += 1;
    picked.add(id);

    const before = placed.get(id);
    if (before !== undefined) {
      const observed = draws - before.draw - 1;
      checks += 1;
      if (before.large) largePoolChecks += 1;
      if (observed < before.gapNeed) {
        violations.push(`${id} 第 ${draws} 次取题只隔 ${observed} 道，冷却要求 ${before.gapNeed}`);
      }
      if (observed < before.loNeed) {
        violations.push(`${id} 第 ${draws} 次取题只隔 ${observed} 道，尾部窗口要求 ${before.loNeed}`);
      }
    }
    placed.delete(id);

    const wrong = rng() < 0.3;
    const keep = !wrong && rng() < 0.5;
    if (!wrong && !keep && allowDrop) continue;

    const n = pool.length;
    const gap = gapFor(n);
    pool = reinsert(pool, id, rng);
    placed.set(id, { draw: draws, gapNeed: Math.min(gap, n), loNeed: lowerBound(n), large: n >= gap });

    if (new Set(pool).size !== pool.length) violations.push(`第 ${draws} 步队列出现重复 id`);
  }

  return { draws, picked, pool, checks, largePoolChecks, violations };
}

describe('QueueConfig / gapFor / windowFor', () => {
  it('DEFAULT_QUEUE 就是 5 / 0.15 / 3 / 0.25', () => {
    expect(DEFAULT_QUEUE).toEqual({
      minGapAbs: 5,
      minGapRatio: 0.15,
      tailWindowAbs: 3,
      tailWindowRatio: 0.25,
    });
  });

  it('gapFor = max(5, ceil(0.15 × 剩余题数))', () => {
    expect(gapFor(0)).toBe(5);
    expect(gapFor(-5)).toBe(5);
    expect(gapFor(7)).toBe(5);
    expect(gapFor(33)).toBe(5);
    expect(gapFor(40)).toBe(6);
    expect(gapFor(60)).toBe(9);
    expect(gapFor(100)).toBe(15);
  });

  it('windowFor = max(3, ceil(0.25 × 剩余题数))', () => {
    expect(windowFor(0)).toBe(3);
    expect(windowFor(7)).toBe(3);
    expect(windowFor(12)).toBe(3);
    expect(windowFor(40)).toBe(10);
    expect(windowFor(60)).toBe(15);
    expect(windowFor(100)).toBe(25);
  });

  it('自定义 QueueConfig 生效，比例与绝对值都能压过对方', () => {
    const loose: QueueConfig = {
      minGapAbs: 2,
      minGapRatio: 0.5,
      tailWindowAbs: 1,
      tailWindowRatio: 0.5,
    };
    expect(gapFor(40, loose)).toBe(20);
    expect(windowFor(40, loose)).toBe(20);
    expect(gapFor(2, loose)).toBe(2);
    expect(gapFor(1, loose)).toBe(2);
    expect(windowFor(1, loose)).toBe(1);
  });
});

describe('reinsert', () => {
  it('池子比冷却步数还小时排到队尾', () => {
    expect(reinsert(['a', 'b'], 'a', mulberry32(1))).toEqual(['b', 'a']);
  });

  it('队列只剩这一题时直接放回单元素队列', () => {
    expect(reinsert([], 'a', mulberry32(1))).toEqual(['a']);
    expect(reinsert(['a'], 'a', mulberry32(1))).toEqual(['a']);
  });

  it('200 个种子：重插下标落在 [lo, n] 内，且不是固定队尾', () => {
    const pending = makePool(40);
    const n = pending.length - 1;
    const lo = lowerBound(n);
    const positions = new Set<number>();
    for (let seed = 1; seed <= 200; seed += 1) {
      const out = reinsert(pending, 'q00', mulberry32(seed));
      expect(out).toHaveLength(pending.length);
      expect(new Set(out).size).toBe(pending.length);
      const position = out.indexOf('q00');
      expect(position).toBeGreaterThanOrEqual(lo);
      expect(position).toBeLessThanOrEqual(n);
      positions.add(position);
    }
    expect(positions.size).toBeGreaterThan(1);
    expect(positions.has(n)).toBe(true);
  });

  it('不修改入参，冻结数组也能用', () => {
    const pending = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const snapshot = [...pending];
    const out = reinsert(pending, 'b', mulberry32(3));
    expect(pending).toEqual(snapshot);
    expect(out).not.toBe(pending);

    const frozen = Object.freeze(['a', 'b', 'c']);
    expect(() => reinsert(frozen, 'a', mulberry32(24))).not.toThrow();
  });

  it('id 不在队列里时按尾部窗口插入且不丢题', () => {
    const out = reinsert(['a', 'b', 'c'], 'z', mulberry32(8));
    expect(out).toHaveLength(4);
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'z']);
  });
});

describe('pickNext', () => {
  it('永远取队首，空队列返回 null', () => {
    expect(pickNext([])).toBeNull();
    expect(pickNext(['a', 'b', 'c'])).toBe('a');
    expect(pickNext(makePool(60))).toBe('q00');
  });
});

describe('I5：调度与 stars 无关', () => {
  it('pickNext 只返回队首；同种子重插完全一致，签名里没有 stars', () => {
    expect(pickNext.length).toBe(1);
    expect(reinsert.length).toBe(3); // cfg 有默认值，不进 length
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 4 }), { minLength: 1, maxLength: 15 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        (pending, seed) => {
          const head = pickNext(pending);
          expect(head).toBe(pending[0]);
          // 换数组引用、重复调用都不会改变结果：调度只看 pending
          expect(pickNext([...pending])).toBe(head);
          expect(pickNext(pending)).toBe(head);
          if (head === null) return;
          const once = reinsert(pending, head, mulberry32(seed));
          const again = reinsert(pending, head, mulberry32(seed));
          expect(once).toEqual(again);
          // 重插不引入重复，也不丢 id
          expect(once).toHaveLength(pending.length);
          expect([...once].sort()).toEqual([...pending].sort());
        },
      ),
    );
  });
});

describe('长跑不变量', () => {
  it('60 题最多 3000 次取题：冷却间隔成立、每题都取到、队列无重复', () => {
    const result = simulate({ maxDraws: 3000, rng: mulberry32(2024), allowDrop: true });
    expect(result.violations).toEqual([]);
    expect(result.draws).toBeGreaterThan(QUESTION_COUNT);
    expect(result.checks).toBeGreaterThan(0);
    expect(result.largePoolChecks).toBeGreaterThan(0);
    expect(result.picked.size).toBe(QUESTION_COUNT);
    expect(new Set(result.pool).size).toBe(result.pool.length);
  });

  it('全程重插 3000 次：队列稳定 60 题，间隔与去重都不破', () => {
    const result = simulate({ maxDraws: 3000, rng: mulberry32(7), allowDrop: false });
    expect(result.violations).toEqual([]);
    expect(result.draws).toBe(3000);
    expect(result.checks).toBeGreaterThan(2900);
    expect(result.largePoolChecks).toBe(result.checks);
    expect(result.picked.size).toBe(QUESTION_COUNT);
    expect(result.pool).toHaveLength(QUESTION_COUNT);
  });
});
