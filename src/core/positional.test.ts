import { describe, expect, it } from 'vitest';
import { isPositionalLabel } from './positional';

describe('isPositionalLabel 正向', () => {
  it('「以上都对」这类全对写法命中', () => {
    expect(isPositionalLabel('以上都对')).toBe(true);
    expect(isPositionalLabel('上述都对')).toBe(true);
    expect(isPositionalLabel('全都对')).toBe(true);
    expect(isPositionalLabel('全对')).toBe(true);
    expect(isPositionalLabel('以上全对')).toBe(true);
  });

  it('「以上都不对」这类全错写法命中', () => {
    expect(isPositionalLabel('以上都不对')).toBe(true);
    expect(isPositionalLabel('以上都不正确')).toBe(true);
    expect(isPositionalLabel('上述均不正确')).toBe(true);
    expect(isPositionalLabel('全部错误')).toBe(true);
    expect(isPositionalLabel('全错')).toBe(true);
  });

  it('「上述均正确」「全部正确」「都不对」「都对」命中', () => {
    expect(isPositionalLabel('上述均正确')).toBe(true);
    expect(isPositionalLabel('全部正确')).toBe(true);
    expect(isPositionalLabel('都不对')).toBe(true);
    expect(isPositionalLabel('都对')).toBe(true);
  });

  it('带「答案 / 选项 / 说法」等名词的写法命中', () => {
    expect(isPositionalLabel('以上答案都正确')).toBe(true);
    expect(isPositionalLabel('以上选项都不对')).toBe(true);
    expect(isPositionalLabel('上述说法均正确')).toBe(true);
    expect(isPositionalLabel('以上三种说法都正确')).toBe(true);
    expect(isPositionalLabel('以上3种说法都对')).toBe(true);
  });

  it('句末标点、空格、全角符号、零宽字符都不影响判定', () => {
    expect(isPositionalLabel('以上都对。')).toBe(true);
    expect(isPositionalLabel(' 以上 都 对！')).toBe(true);
    expect(isPositionalLabel('以上都对\u200B')).toBe(true);
  });

  it('英文等价写法也命中', () => {
    expect(isPositionalLabel('None of the above')).toBe(true);
    expect(isPositionalLabel('All of the above.')).toBe(true);
  });
});

describe('isPositionalLabel 反向', () => {
  it('「以上三种说法」这类普通选项不被误判', () => {
    expect(isPositionalLabel('以上三种说法')).toBe(false);
    expect(isPositionalLabel('上述四种情况')).toBe(false);
    expect(isPositionalLabel('以上四项内容')).toBe(false);
  });

  it('没有位置前缀的普通选项不被误判', () => {
    expect(isPositionalLabel('对')).toBe(false);
    expect(isPositionalLabel('正确')).toBe(false);
    expect(isPositionalLabel('不对')).toBe(false);
    expect(isPositionalLabel('甲乙都对')).toBe(false);
    expect(isPositionalLabel('A、B都不对')).toBe(false);
    expect(isPositionalLabel('全部')).toBe(false);
    expect(isPositionalLabel('以上')).toBe(false);
    expect(isPositionalLabel('上述均')).toBe(false);
    expect(isPositionalLabel('以上内容')).toBe(false);
  });

  it('前缀后面还有别的语义时不算位置相关', () => {
    expect(isPositionalLabel('以上都对但C错')).toBe(false);
    expect(isPositionalLabel('都对吗')).toBe(false);
    expect(isPositionalLabel('全都选了')).toBe(false);
    expect(isPositionalLabel('全部都是')).toBe(false);
    expect(isPositionalLabel('以上正确答案')).toBe(false);
  });

  it('空白或空串返回 false', () => {
    expect(isPositionalLabel('')).toBe(false);
    expect(isPositionalLabel('   ')).toBe(false);
    expect(isPositionalLabel('。')).toBe(false);
  });
});
