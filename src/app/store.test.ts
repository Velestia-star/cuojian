import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../core/rng';
import { MemoryRepository } from '../db/memoryRepository';
import type { NewQuestionInput, QuestionBundle } from '../types';
import { UNDO_WINDOW_MS, createAppStore, type AppDeps, type AppStore } from './store';

const T0 = 1_700_000_000_000;

function choiceInput(stem: string): NewQuestionInput {
  return {
    kind: 'choice',
    stem,
    explanation: null,
    subject: null,
    difficulty: 3,
    multi: false,
    shuffleLocked: false,
    blankStrict: false,
    ignoreCase: true,
    options: [
      { text: '正确项', isCorrect: true, positional: false },
      { text: '干扰项', isCorrect: false, positional: false },
    ],
    blanks: [],
  };
}

function blankInput(stem: string, accepts: string[], strict: boolean): NewQuestionInput {
  return {
    kind: 'blank',
    stem,
    explanation: null,
    subject: null,
    difficulty: 3,
    multi: false,
    shuffleLocked: false,
    blankStrict: strict,
    ignoreCase: true,
    options: [],
    blanks: [{ accepts }],
  };
}

interface Harness {
  repo: MemoryRepository;
  deps: AppDeps;
  clock: { advance: (ms: number) => void };
  store: AppStore;
}

async function makeHarness(seedCount = 6): Promise<Harness> {
  const repo = new MemoryRepository();
  for (let i = 0; i < seedCount; i += 1) {
    await repo.createQuestion(choiceInput(`第 ${i + 1} 题的题干`), T0 + i);
  }
  let t = T0;
  let n = 0;
  const deps: AppDeps = {
    repo,
    rng: mulberry32(2024),
    now: () => t,
    newId: () => `session-${(n += 1)}`,
  };
  const store = createAppStore(deps);
  await store.getState().init();
  return { repo, deps, clock: { advance: (ms) => (t += ms) }, store };
}

function headOf(store: AppStore): string {
  const { round } = store.getState();
  if (!round) throw new Error('没有进行中的一轮');
  const head = round.pending[0];
  if (!head) throw new Error('队列已空');
  return head;
}

function bundleOf(store: AppStore, questionId: string): QuestionBundle {
  const bundle = store.getState().questions.find((b) => b.question.id === questionId);
  if (!bundle) throw new Error(`找不到题目 ${questionId}`);
  return bundle;
}

function correctOptionId(bundle: QuestionBundle): string {
  const option = bundle.options.find((o) => o.isCorrect);
  if (!option) throw new Error('题目没有正确选项');
  return option.id;
}

function wrongOptionId(bundle: QuestionBundle): string {
  const option = bundle.options.find((o) => !o.isCorrect);
  if (!option) throw new Error('题目没有干扰项');
  return option.id;
}

describe('R5 答错', () => {
  it('星数 +1、题目重排、只追加一条 attempt', async () => {
    const { repo, clock, store } = await makeHarness();
    await store.getState().startPractice();
    const head = headOf(store);
    const bundle = bundleOf(store, head);

    clock.advance(1200);
    await store.getState().answerChoice([wrongOptionId(bundle)]);

    const state = store.getState();
    expect(state.feedback?.isCorrect).toBe(false);
    expect(state.round?.served).toBe(1);
    expect(state.round?.correct).toBe(0);
    expect(state.round?.pending).toContain(head);
    expect(state.round?.pending[0]).not.toBe(head);

    const attempts = await repo.listAttempts(head);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.isCorrect).toBe(false);
    expect(attempts[0]?.graderVersion).toBe(1);
    expect(attempts[0]?.durationMs).toBe(1200);

    const card = bundleOf(store, head).card;
    expect(card.wrongCount).toBe(1);
    expect(card.stars).toBe(1);
    expect(card.lastResult).toBe('wrong');
  });
});

describe('R6 答对后的二选一', () => {
  it('保留：题目回到队列，位置不在队首', async () => {
    const { clock, store } = await makeHarness();
    await store.getState().startPractice();
    const head = headOf(store);
    const bundle = bundleOf(store, head);

    await store.getState().answerChoice([correctOptionId(bundle)]);
    expect(store.getState().round?.pendingChoice?.questionId).toBe(head);
    expect(store.getState().round?.correct).toBe(1);

    clock.advance(400);
    await store.getState().chooseKeep();

    const state = store.getState();
    expect(state.round?.pendingChoice).toBeNull();
    expect(state.round?.pending).toContain(head);
    expect(state.round?.pending[0]).not.toBe(head);
    expect(state.viewQuestionId).toBe(state.round?.pending[0]);
    expect(state.feedback).toBeNull();
  });

  it('划去：软删除、移出队列、attempt 保留、5 秒内可撤销（I6）', async () => {
    const { repo, clock, store } = await makeHarness();
    await store.getState().startPractice();
    const head = headOf(store);
    await store.getState().answerChoice([correctOptionId(bundleOf(store, head))]);

    await store.getState().chooseArchive();
    expect(store.getState().undo?.questionId).toBe(head);
    expect(store.getState().round?.pending).not.toContain(head);
    expect((await repo.getBundle(head))?.question.archivedAt).not.toBeNull();
    expect(await repo.listAttempts(head)).toHaveLength(1);

    clock.advance(1000);
    await store.getState().undoArchive();
    expect(store.getState().undo).toBeNull();
    expect((await repo.getBundle(head))?.question.archivedAt).toBeNull();
    expect(store.getState().round?.pending).toContain(head);
    // 撤销只是恢复入池，历史作答不会被删除
    expect(await repo.listAttempts(head)).toHaveLength(1);
  });

  it('超过 5 秒撤销无效，题目保持划去', async () => {
    const { repo, clock, store } = await makeHarness();
    await store.getState().startPractice();
    const head = headOf(store);
    await store.getState().answerChoice([correctOptionId(bundleOf(store, head))]);
    await store.getState().chooseArchive();

    clock.advance(UNDO_WINDOW_MS + 1);
    await store.getState().undoArchive();

    expect(store.getState().undo).toBeNull();
    expect((await repo.getBundle(head))?.question.archivedAt).not.toBeNull();
  });
});

describe('R15 未选择就退出', () => {
  it('重新初始化时按「保留」恢复，不丢失已作答记录', async () => {
    const { deps, store } = await makeHarness();
    await store.getState().startPractice();
    const head = headOf(store);
    await store.getState().answerChoice([correctOptionId(bundleOf(store, head))]);
    expect(store.getState().round?.pendingChoice?.questionId).toBe(head);

    // 模拟杀掉进程后重新打开：同一个 Repository，新的 store 实例
    const reopened = createAppStore(deps);
    await reopened.getState().init();

    const round = reopened.getState().round;
    expect(round?.pendingChoice).toBeNull();
    expect(round?.pending).toContain(head);
    expect(round?.correct).toBe(1);
    expect(round?.served).toBe(1);
  });
});

describe('R12 队列持久化', () => {
  it('重新打开后接着上次的位置，不重新打乱', async () => {
    const { deps, store } = await makeHarness();
    await store.getState().startPractice();
    const head = headOf(store);
    await store.getState().answerChoice([wrongOptionId(bundleOf(store, head))]);
    const saved = store.getState().round?.pending ?? [];
    expect(saved.length).toBeGreaterThan(0);

    const reopened = createAppStore(deps);
    await reopened.getState().init();
    expect(reopened.getState().round?.pending).toEqual(saved);
    expect(reopened.getState().viewQuestionId).toBe(saved[0]);
  });
});

describe('R13 一轮可结束', () => {
  it('单轮上限 50：池子更大也只取 50 道', async () => {
    const { store } = await makeHarness(60);
    await store.getState().startPractice();
    expect(store.getState().round?.total).toBe(50);
    expect(store.getState().round?.pending).toHaveLength(50);
  });

  it('用户点「结束本轮」后进入结算态', async () => {
    const { store } = await makeHarness();
    await store.getState().startPractice();
    await store.getState().finishRound();
    expect(store.getState().sessionFinished).toBe(true);
    expect(store.getState().round?.finishedAt).not.toBeNull();
  });
});

describe('R10 填空题判定接线', () => {
  it('宽松模式 1/2 接受 0.5', async () => {
    const repo = new MemoryRepository();
    await repo.createQuestion(blankInput('二分之一等于', ['1/2'], false), T0);
    const deps: AppDeps = {
      repo,
      rng: mulberry32(1),
      now: () => T0,
      newId: () => 's-blank',
    };
    const store = createAppStore(deps);
    await store.getState().init();
    await store.getState().startPractice();
    await store.getState().answerBlank(['0.5']);
    expect(store.getState().feedback?.isCorrect).toBe(true);
  });

  it('严格模式不会把 1.5 当成 15', async () => {
    const repo = new MemoryRepository();
    await repo.createQuestion(blankInput('答案是 15', ['15'], true), T0);
    const deps: AppDeps = {
      repo,
      rng: mulberry32(1),
      now: () => T0,
      newId: () => 's-blank-strict',
    };
    const store = createAppStore(deps);
    await store.getState().init();
    await store.getState().startPractice();
    await store.getState().answerBlank(['1.5']);
    expect(store.getState().feedback?.isCorrect).toBe(false);
  });
});

describe('题库侧操作', () => {
  it('划去正在排队的题目会把它从队列里摘掉', async () => {
    const { store } = await makeHarness();
    await store.getState().startPractice();
    const head = headOf(store);
    const other = store
      .getState()
      .round?.pending.find((id) => id !== head);
    expect(other).toBeDefined();

    await store.getState().archiveQuestion(other ?? '');
    expect(store.getState().round?.pending).not.toContain(other);
    expect(store.getState().round?.pending).toContain(head);
  });

  it('新录入的题目进入题库并带 0 星', async () => {
    const { store } = await makeHarness(1);
    const id = await store.getState().createQuestion(choiceInput('新题'));
    const bundle = bundleOf(store, id);
    expect(bundle.question.revision).toBe(1);
    expect(bundle.card.stars).toBe(0);
    expect(bundle.question.archivedAt).toBeNull();
  });
});
