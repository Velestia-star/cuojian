import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../core/rng';
import {
  MAX_PER_ROUND,
  applyArchive,
  applyCorrect,
  applyKeep,
  applyWrong,
  currentQuestionId,
  endRoundByUser,
  progressOf,
  resumeChoiceAsKeep,
  startRound,
} from './engine';

const pool = (n: number): string[] => Array.from({ length: n }, (_, i) => `q${i}`);

describe('开轮', () => {
  it('整池打乱且不超过单轮上限', () => {
    const round = startRound(pool(60), mulberry32(1), 1000, 's1');
    expect(round.pending).toHaveLength(MAX_PER_ROUND);
    expect(round.total).toBe(MAX_PER_ROUND);
    expect(new Set(round.pending).size).toBe(MAX_PER_ROUND);
    expect(round.served).toBe(0);
    expect(round.correct).toBe(0);
    expect(round.finishedAt).toBeNull();
  });

  it('同种子得到同一顺序，不同种子得到不同顺序', () => {
    const a = startRound(pool(20), mulberry32(7), 1, 's');
    const b = startRound(pool(20), mulberry32(7), 1, 's');
    const c = startRound(pool(20), mulberry32(8), 1, 's');
    expect(a.pending).toEqual(b.pending);
    expect(a.pending).not.toEqual(c.pending);
  });

  it('重复 id 会被去掉，避免同一题在队列里出现两次', () => {
    const round = startRound(['a', 'a', 'b', 'c'], mulberry32(3), 1, 's');
    expect(round.pending).toHaveLength(3);
    expect(new Set(round.pending).size).toBe(3);
  });

  it('空池开轮直接结束', () => {
    const round = startRound([], mulberry32(1), 1000, 's');
    expect(round.finishedAt).toBe(1000);
    expect(currentQuestionId(round)).toBeNull();
  });
});

describe('答错：重排（R5/R7/R8）', () => {
  it('计一次错，题目插回队列且不在队首', () => {
    const round = startRound(pool(20), mulberry32(11), 1000, 's');
    const head = currentQuestionId(round);
    expect(head).not.toBeNull();
    const next = applyWrong(round, mulberry32(12), 2000);
    expect(next.served).toBe(1);
    expect(next.correct).toBe(0);
    expect(next.pending).toHaveLength(20);
    expect(next.pending).toContain(head);
    expect(next.pending[0]).not.toBe(head);
    expect(next.finishedAt).toBeNull();
  });

  it('池子只剩一两道题时也不会立刻重复', () => {
    const round = startRound(pool(2), mulberry32(5), 1000, 's');
    const head = currentQuestionId(round);
    const next = applyWrong(round, mulberry32(6), 2000);
    // 冷却放不下，排到队尾；此时队列里另一道题先出
    expect(next.pending[0]).not.toBe(head);
    expect(next.pending[next.pending.length - 1]).toBe(head);
  });
});

describe('答对：二选一（R6）', () => {
  it('先取走题目并挂起选择，不重复计数', () => {
    const round = startRound(pool(10), mulberry32(2), 1000, 's');
    const head = currentQuestionId(round);
    const next = applyCorrect(round, 2000);
    expect(next.pendingChoice).toEqual({ questionId: head, askedAt: 2000 });
    expect(next.served).toBe(1);
    expect(next.correct).toBe(1);
    expect(next.pending).toHaveLength(9);
    expect(next.pending).not.toContain(head);
  });

  it('保留 = 插回队列，位置不在队首', () => {
    const round = applyCorrect(startRound(pool(10), mulberry32(2), 1000, 's'), 2000);
    const head = round.pendingChoice?.questionId;
    const kept = applyKeep(round, mulberry32(9), 3000);
    expect(kept.pendingChoice).toBeNull();
    expect(kept.pending).toHaveLength(10);
    expect(kept.pending).toContain(head);
    expect(kept.pending[0]).not.toBe(head);
    expect(kept.served).toBe(1);
    expect(kept.correct).toBe(1);
  });

  it('划去 = 从队列移除，served/correct 不变', () => {
    const round = applyCorrect(startRound(pool(10), mulberry32(2), 1000, 's'), 2000);
    const head = round.pendingChoice?.questionId;
    const archived = applyArchive(round, 3000);
    expect(archived.pendingChoice).toBeNull();
    expect(archived.pending).toHaveLength(9);
    expect(archived.pending).not.toContain(head);
    expect(archived.served).toBe(1);
    expect(archived.correct).toBe(1);
  });

  it('最后一道题划掉后本轮结束', () => {
    const round = applyCorrect(startRound(['only'], mulberry32(2), 1000, 's'), 2000);
    const archived = applyArchive(round, 3000);
    expect(archived.pending).toHaveLength(0);
    expect(archived.finishedAt).toBe(3000);
  });

  it('R15：没选就退出，恢复时按保留处理', () => {
    const round = applyCorrect(startRound(pool(10), mulberry32(2), 1000, 's'), 2000);
    const head = round.pendingChoice?.questionId;
    const resumed = resumeChoiceAsKeep(round, mulberry32(4), 3000);
    expect(resumed.pendingChoice).toBeNull();
    expect(resumed.pending).toContain(head);
    expect(resumed.served).toBe(1);
    expect(resumed.correct).toBe(1);
  });
});

describe('结束条件（R13）', () => {
  it('用户点结束：保留队列，标记结束时间', () => {
    const round = startRound(pool(5), mulberry32(1), 1000, 's');
    const ended = endRoundByUser(round, 5000);
    expect(ended.finishedAt).toBe(5000);
    expect(ended.pending).toHaveLength(5);
    expect(endRoundByUser(ended, 9000).finishedAt).toBe(5000);
  });

  it('达到 50 题上限自动结束', () => {
    let round = startRound(pool(10), mulberry32(1), 1000, 's');
    let now = 1000;
    for (let i = 0; i < MAX_PER_ROUND; i += 1) {
      round = applyWrong(round, mulberry32(100 + i), (now += 1000));
    }
    expect(round.served).toBe(MAX_PER_ROUND);
    expect(round.finishedAt).not.toBeNull();
  });
});

describe('进度口径（R13）', () => {
  it('进度 = 已作答 / (已作答 + 队列剩余 + 待选择)', () => {
    const round = startRound(pool(10), mulberry32(1), 1000, 's');
    expect(progressOf(round)).toEqual({ served: 0, total: 10 });

    const wrong = applyWrong(round, mulberry32(2), 2000);
    expect(progressOf(wrong)).toEqual({ served: 1, total: 11 });

    const correct = applyCorrect(round, 2000);
    expect(progressOf(correct)).toEqual({ served: 1, total: 11 });
  });
});
