import { describe, expect, it } from 'vitest';
import { mulberry32 } from './rng';
import { optionLetters, shuffle, shuffleOptions, type ShufflableOption } from './shuffle';

const EIGHT = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

describe('shuffle', () => {
  it('保持多重集：长度与元素集合都不变', () => {
    const out = shuffle(EIGHT, mulberry32(42));
    expect(out).toHaveLength(EIGHT.length);
    expect([...out].sort()).toEqual([...EIGHT].sort());
  });

  it('同一 rng 种子可复现，不同种子结果不同', () => {
    expect(shuffle(EIGHT, mulberry32(11))).toEqual(shuffle(EIGHT, mulberry32(11)));
    expect(shuffle(EIGHT, mulberry32(11))).not.toEqual(shuffle(EIGHT, mulberry32(12)));
  });

  it('不修改入参', () => {
    const input = [...EIGHT];
    const snapshot = [...input];
    shuffle(input, mulberry32(9));
    expect(input).toEqual(snapshot);
  });

  it('空数组与单元素数组原样返回副本', () => {
    expect(shuffle([], mulberry32(1))).toEqual([]);
    const one = ['only'];
    const single = shuffle(one, mulberry32(1));
    expect(single).toEqual(one);
    expect(single).not.toBe(one);
  });

  it('8 个选项洗 20000 次，正确项落到每个位置的频率接近 1/8（容差 ±0.02）', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `opt${i}`);
    const rng = mulberry32(20240601);
    const trials = 20000;
    const counts = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let trial = 0; trial < trials; trial += 1) {
      counts[shuffle(ids, rng).indexOf('opt0')] += 1;
    }
    for (let position = 0; position < 8; position += 1) {
      expect(Math.abs(counts[position] / trials - 1 / 8)).toBeLessThanOrEqual(0.02);
    }
  });
});

describe('optionLetters', () => {
  it('1 起算，8 个选项得到 A..H', () => {
    expect(optionLetters(8)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    expect(optionLetters(1)).toEqual(['A']);
    expect(optionLetters(4)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('数量为 0 或负数时返回空数组', () => {
    expect(optionLetters(0)).toEqual([]);
    expect(optionLetters(-2)).toEqual([]);
  });
});

describe('shuffleOptions', () => {
  const options: ShufflableOption[] = EIGHT.map((id) => ({ id }));

  it('shuffleLocked = true 时按原顺序返回副本，不与入参共享引用', () => {
    const kept = shuffleOptions(options, true, mulberry32(3));
    expect(kept.map((option) => option.id)).toEqual(EIGHT);
    expect(kept).not.toBe(options);
    kept.push({ id: 'z' });
    expect(options).toHaveLength(8);
  });

  it('shuffleLocked = false 时与 shuffle 一致、可复现且不修改入参', () => {
    const once = shuffleOptions(options, false, mulberry32(77)).map((option) => option.id);
    const twice = shuffleOptions(options, false, mulberry32(77)).map((option) => option.id);
    expect(once).toEqual(twice);
    expect([...once].sort()).toEqual([...EIGHT].sort());
    expect(options.map((option) => option.id)).toEqual(EIGHT);
  });
});
