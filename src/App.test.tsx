import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// 用内存仓库替换真实 IndexedDB 组合根：这里验的是「启动 → 路由 → 首屏」，
// 不是 Dexie 本身（Dexie 的读写由 store.test.ts 的内存实现以同一语义覆盖）。
vi.mock('./app/deps', async () => {
  const { createAppStore } = await import('./app/store');
  const { MemoryRepository } = await import('./db/memoryRepository');
  const { mulberry32 } = await import('./core/rng');
  const store = createAppStore({
    repo: new MemoryRepository(),
    rng: mulberry32(1),
    now: () => 1_700_000_000_000,
    newId: () => 'session-1',
  });
  return { appStore: store, appDeps: {} };
});

import App from './App';

describe('应用启动', () => {
  it('题库为空时给出录入引导，而不是白屏', async () => {
    render(<App />);
    expect(await screen.findByText('录入第一道错题')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '错笺' })).toBeInTheDocument();
  });
});
