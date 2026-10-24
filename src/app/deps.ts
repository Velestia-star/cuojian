import { mulberry32 } from '../core/rng';
import { db } from '../db/db';
import { DexieRepository } from '../db/dexieRepository';
import type { AppDeps } from './store';
import { createAppStore } from './store';

/**
 * 组合根：只有这里允许读取真实时间/随机源，测试把 AppDeps 换成假时钟 + 固定种子。
 * mulberry32 的种子取自启动时刻，保证每次练习的洗牌顺序不同。
 */
export const appDeps: AppDeps = {
  repo: new DexieRepository(),
  rng: mulberry32(Date.now() >>> 0),
  now: () => Date.now(),
  newId: () => crypto.randomUUID(),
};

export const appStore = createAppStore(appDeps);

// 启动时顺手打开数据库，schema 不兼容会尽早暴露，而不是等用户点保存
void db.open().catch(() => undefined);
