import type {
  AttemptRow,
  NewQuestionInput,
  QuestionBundle,
  RoundState,
} from '../types';

export interface AttemptRecord {
  questionId: string;
  sessionId: string;
  isCorrect: boolean;
  /** 选择题传 option id 数组；填空题传逐空文本数组 */
  userAnswer: string;
  durationMs: number;
  graderVersion: number;
}

/**
 * 业务层唯一的数据入口。组件不允许直接碰 Dexie/IndexedDB，
 * 以后换 SQLite（Capacitor）只需要再实现一个 Repository。
 */
export interface Repository {
  listBundles(): Promise<QuestionBundle[]>;
  getBundle(id: string): Promise<QuestionBundle | null>;
  createQuestion(input: NewQuestionInput, now: number): Promise<QuestionBundle>;

  /** R15：软删除，历史 attempt 保留；恢复时清 archivedAt */
  archiveQuestion(id: string, now: number): Promise<void>;
  restoreQuestion(id: string, now: number): Promise<void>;

  /** R11：只追加；同时推卡片状态（wrongCount / stars / lastResult） */
  appendAttempt(record: AttemptRecord, now: number): Promise<void>;
  listAttempts(questionId: string): Promise<AttemptRow[]>;

  createSession(id: string, now: number): Promise<void>;
  finishSession(
    id: string,
    now: number,
    total: number,
    correct: number,
  ): Promise<void>;

  /** R12：退出再进接着上次的队列，不重新打乱 */
  saveRound(round: RoundState): Promise<void>;
  loadRound(): Promise<RoundState | null>;
  clearRound(): Promise<void>;
}

/** 主题、上次导出时间这类杂项都放 setting 表，不新建表。 */
export const SETTING_KEYS = {
  activeRound: 'activeRound',
} as const;
