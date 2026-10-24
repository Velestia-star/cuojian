import { describe, expect, it } from 'vitest';
import { gradeBlank, gradeChoice, normalizeBlank } from './grade';

describe('gradeChoice', () => {
  it('集合相等即判对，与顺序无关', () => {
    expect(gradeChoice(['a'], ['a'])).toBe(true);
    expect(gradeChoice(['a', 'c'], ['c', 'a'])).toBe(true);
    expect(gradeChoice(['a', 'b', 'c'], ['b', 'a', 'c'])).toBe(true);
  });

  it('漏选判错', () => {
    expect(gradeChoice(['a', 'b', 'c'], ['a', 'b'])).toBe(false);
    expect(gradeChoice(['a'], [])).toBe(false);
  });

  it('多选判错', () => {
    expect(gradeChoice(['a'], ['a', 'b'])).toBe(false);
    expect(gradeChoice(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
  });

  it('空选一律判错', () => {
    expect(gradeChoice(['a'], [])).toBe(false);
    expect(gradeChoice([], [])).toBe(false);
  });

  it('重复 id 按集合语义去重后比较', () => {
    expect(gradeChoice(['a', 'b'], ['b', 'a', 'a'])).toBe(true);
    expect(gradeChoice(['a', 'a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('选错成别的 id 判错', () => {
    expect(gradeChoice(['a', 'b'], ['a', 'd'])).toBe(false);
  });
});

describe('normalizeBlank', () => {
  it('全角转半角（NFKC）', () => {
    expect(normalizeBlank('１２３', true)).toBe('123');
    expect(normalizeBlank('ＡＴＰ', true)).toBe('ATP');
    expect(normalizeBlank('０.５', true)).toBe('0.5');
  });

  it('删掉零宽字符', () => {
    expect(normalizeBlank('a\u200Bb\u200Dc\uFEFFd', true)).toBe('abcd');
    expect(normalizeBlank('鲁\u200B迅', true)).toBe('鲁迅');
  });

  it('strict 保留单个空格并 trim', () => {
    expect(normalizeBlank('  a   b  ', true)).toBe('a b');
    expect(normalizeBlank('\ta\tb\n', true)).toBe('a b');
  });

  it('宽松模式删掉全部空白', () => {
    expect(normalizeBlank(' a\tb\nc ', false)).toBe('abc');
    expect(normalizeBlank('1 / 2', false)).toBe('1/2');
  });

  it('大小写只由 ignoreCase 控制', () => {
    expect(normalizeBlank('ATP', true, true)).toBe('atp');
    expect(normalizeBlank('ATP', true, false)).toBe('ATP');
    expect(normalizeBlank('ATP', true)).toBe('ATP');
    expect(normalizeBlank('ATP', false, true)).toBe('atp');
  });

  it('句末标点只有宽松模式才去掉，且能吃掉连续多个', () => {
    expect(normalizeBlank('答案。', false)).toBe('答案');
    expect(normalizeBlank('答案！？', false)).toBe('答案');
    expect(normalizeBlank('答案,;', false)).toBe('答案');
    expect(normalizeBlank('答案、，。', false)).toBe('答案');
    expect(normalizeBlank('答案。', true)).toBe('答案。');
    // NFKC 会把全角逗号转成半角，所以 strict 下保留的是 '答案,。'
    expect(normalizeBlank('答案，。', true)).toBe('答案,。');
  });

  it('句子中间的标点保留', () => {
    expect(normalizeBlank('a,b', false)).toBe('a,b');
    expect(normalizeBlank('H2O，水', false)).toBe('H2O,水');
  });

  it('归一化幂等：normalize(normalize(x)) === normalize(x)', () => {
    const samples = [' ＡＢＣ。 ', 'a\u200Bb', '  x   y  ', 'ATP!?', '1 / 2', ' 50％ ', '答案、，。'];
    for (const sample of samples) {
      for (const strict of [true, false]) {
        for (const ignoreCase of [true, false]) {
          const once = normalizeBlank(sample, strict, ignoreCase);
          expect(normalizeBlank(once, strict, ignoreCase)).toBe(once);
        }
      }
    }
  });
});

describe('gradeBlank', () => {
  it('宽松模式下 1/2 与 0.5 数值等价', () => {
    expect(gradeBlank(['0.5'], '1/2', false)).toBe(true);
    expect(gradeBlank(['1/2'], '0.5', false)).toBe(true);
  });

  it('strict 模式不做数值等价', () => {
    expect(gradeBlank(['0.5'], '1/2', true)).toBe(false);
    expect(gradeBlank(['3'], '3.0', true)).toBe(false);
  });

  it('百分数与小数等价（宽松）', () => {
    expect(gradeBlank(['0.5'], '50%', false)).toBe(true);
    expect(gradeBlank(['50%'], '0.5', false)).toBe(true);
    expect(gradeBlank(['0.5'], '５０％', false)).toBe(true);
  });

  it('小数尾零不影响数值等价（宽松）', () => {
    expect(gradeBlank(['3'], '3.0', false)).toBe(true);
    expect(gradeBlank(['3.00'], '3', false)).toBe(true);
  });

  it('同一空有多个可接受答案，任一命中即对', () => {
    expect(gradeBlank(['鲁迅', '周树人'], '鲁迅', true)).toBe(true);
    expect(gradeBlank(['鲁迅', '周树人'], '周树人', true)).toBe(true);
    expect(gradeBlank(['鲁迅', '周树人'], '茅盾', true)).toBe(false);
  });

  it('空输入一律判错', () => {
    expect(gradeBlank(['鲁迅'], '', true)).toBe(false);
    expect(gradeBlank(['鲁迅'], '   ', true)).toBe(false);
    expect(gradeBlank(['0'], '', false)).toBe(false);
    expect(gradeBlank([], '鲁迅', true)).toBe(false);
  });

  it('ignoreCase = false 时 ATP 与 atp 不相等', () => {
    expect(gradeBlank(['ATP'], 'atp', true, false)).toBe(false);
    expect(gradeBlank(['atp'], 'ATP', true, false)).toBe(false);
  });

  it('ignoreCase = true 时大小写不敏感', () => {
    expect(gradeBlank(['ATP'], 'atp', true, true)).toBe(true);
    expect(gradeBlank(['atp'], ' ATP ', false, true)).toBe(true);
  });

  it('负样本：答案是 15 时输入 1.5 必须判错（不能删非数字字符）', () => {
    expect(gradeBlank(['15'], '1.5', false)).toBe(false);
    expect(gradeBlank(['1.5'], '15', false)).toBe(false);
  });

  it('宽松模式容忍句末标点，strict 不容忍', () => {
    expect(gradeBlank(['答案'], '答案。', false)).toBe(true);
    expect(gradeBlank(['答案'], '答案。', true)).toBe(false);
  });

  it('全角、零宽与首尾空白都不影响判定', () => {
    expect(gradeBlank(['ATP'], 'ＡＴＰ', true)).toBe(true);
    expect(gradeBlank(['鲁迅'], '鲁\u200B迅', true)).toBe(true);
    expect(gradeBlank(['ATP'], '  atp  ', true, true)).toBe(true);
  });
});
