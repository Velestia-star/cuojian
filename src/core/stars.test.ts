import { describe, expect, it } from 'vitest';
import { starsOf } from './stars';

describe('starsOf', () => {
  it('星数 = min(5, 答错次数)', () => {
    expect(starsOf(0)).toBe(0);
    expect(starsOf(1)).toBe(1);
    expect(starsOf(3)).toBe(3);
    expect(starsOf(5)).toBe(5);
  });

  it('超过 5 次答错仍然封顶 5 星', () => {
    expect(starsOf(6)).toBe(5);
    expect(starsOf(100)).toBe(5);
  });

  it('负数与非法输入夹到 0', () => {
    expect(starsOf(-3)).toBe(0);
    expect(starsOf(Number.NaN)).toBe(0);
  });

  it('max 可调低或调零上限', () => {
    expect(starsOf(4, 3)).toBe(3);
    expect(starsOf(2, 3)).toBe(2);
    expect(starsOf(7, 0)).toBe(0);
    expect(starsOf(7, 10)).toBe(7);
  });
});
