import { describe, expect, it } from 'vitest';
import { mulberry32, randomInt, type Rng } from './rng';

function takeSequence(seed: number, count: number): number[] {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, () => rng());
}

describe('mulberry32', () => {
  it('同一种子产生完全相同的序列', () => {
    expect(takeSequence(2024, 64)).toEqual(takeSequence(2024, 64));
  });

  it('不同种子的序列不同', () => {
    expect(takeSequence(1, 16)).not.toEqual(takeSequence(2, 16));
  });

  it('返回值都落在 [0, 1) 内', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('种子 0 也正常（序列不会退化成常量）', () => {
    expect(new Set(takeSequence(0, 8)).size).toBeGreaterThan(1);
  });
});

describe('randomInt', () => {
  it('maxExclusive = 1 时恒返回 0', () => {
    const rng = mulberry32(123);
    for (let i = 0; i < 200; i += 1) {
      expect(randomInt(rng, 1)).toBe(0);
    }
  });

  it('覆盖 0..maxExclusive-1 的每个整数且不越界', () => {
    const rng = mulberry32(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const value = randomInt(rng, 6);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      seen.add(value);
    }
    expect(seen.size).toBe(6);
  });

  it('结果完全由注入的 rng 决定', () => {
    const zero: Rng = () => 0;
    const almostOne: Rng = () => 0.9999999999;
    expect(randomInt(zero, 10)).toBe(0);
    expect(randomInt(almostOne, 10)).toBe(9);
    expect(randomInt(almostOne, 1)).toBe(0);
  });

  it('非正 / 非有限的 maxExclusive 回退为 0', () => {
    const rng = mulberry32(5);
    expect(randomInt(rng, 0)).toBe(0);
    expect(randomInt(rng, -3)).toBe(0);
    expect(randomInt(rng, Number.NaN)).toBe(0);
  });

  it('自定义 rng 越界返回 1 时也钳在上界内', () => {
    expect(randomInt(() => 1, 4)).toBe(3);
  });
});
