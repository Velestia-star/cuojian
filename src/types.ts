// 领域类型：数据库行、领域对象、练习运行时状态都从这里取。
// 约定：时间一律是毫秒时间戳（由调用方注入 now），不在这里读时钟。

export type QuestionKind = 'choice' | 'blank';

/** 题目本体。R16：编辑不破坏历史，revision 递增，选项软删除。 */
export interface QuestionRow {
  id: string;
  kind: QuestionKind;
  stem: string;
  explanation: string | null;
  subject: string | null;
  difficulty: number;
  /** 多选题；choice 才有意义 */
  multi: boolean;
  /** R4：含位置相关选项时整题不打乱 */
  shuffleLocked: boolean;
  /** R10：true = 严格（不做空白折叠/标点/数值等价） */
  blankStrict: boolean;
  /** R10：大小写单独控制，化学/物理传 false */
  ignoreCase: boolean;
  revision: number;
  /** R15：非空 = 已划去（软删除），不进入队列 */
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface OptionRow {
  id: string;
  questionId: string;
  /** 录入时顺序，仅作参考；渲染顺序以洗牌结果为准 */
  ord: number;
  text: string;
  isCorrect: boolean;
  /** R4：位置相关选项（以上都对…），v1 只用于录入提示 */
  positional: boolean;
  /** R16：选项软删除，历史 attempt 仍能解释 */
  deletedAt: number | null;
}

export interface BlankAnswerRow {
  id: string;
  questionId: string;
  /** 从 0 开始 */
  blankIndex: number;
  /** 该空的一种可接受写法 */
  text: string;
}

/** 复习状态。wrongCount 是唯一的原始数据，stars 由它推导。 */
export interface CardRow {
  questionId: string;
  wrongCount: number;
  stars: number;
  lastResult: 'wrong' | 'right' | null;
  lastSeenAt: number | null;
  inQueue: boolean;
}

/** R11：attempt 只追加不修改，是历史与星数重算的唯一来源。 */
export interface AttemptRow {
  id: string;
  questionId: string;
  sessionId: string;
  isCorrect: boolean;
  /** JSON 字符串：选择题是 option id 数组，填空题是逐空作答数组 */
  userAnswer: string;
  durationMs: number;
  createdAt: number;
  /** 判定规则版本，规则改了也不会追溯推翻历史结论 */
  graderVersion: number;
}

export interface SessionRow {
  id: string;
  startedAt: number;
  endedAt: number | null;
  total: number;
  correct: number;
}

export interface SettingRow {
  key: string;
  value: string;
}

/** R11/R12：队列持久化。pos 是队内顺序，0 是下一道。 */
export interface QueueItemRow {
  questionId: string;
  pos: number;
}

/** 题目 + 选项/答案 + 复习状态，列表页和作答页都用这个组合读。 */
export interface QuestionBundle {
  question: QuestionRow;
  options: OptionRow[];
  blanks: BlankAnswerRow[];
  card: CardRow;
}

export type NewOptionInput = {
  text: string;
  isCorrect: boolean;
  positional: boolean;
};

export type NewBlankInput = {
  /** 同一个空的多种可接受写法，至少一条 */
  accepts: string[];
};

export interface NewQuestionInput {
  kind: QuestionKind;
  stem: string;
  explanation: string | null;
  subject: string | null;
  difficulty: number;
  multi: boolean;
  shuffleLocked: boolean;
  blankStrict: boolean;
  ignoreCase: boolean;
  options: NewOptionInput[];
  blanks: NewBlankInput[];
}

/**
 * 一轮练习的运行时状态。队列是 pending，pending[0] 就是当前要出的题。
 * total 是开轮时队列长度（≤ 单轮上限），用于结算；进度按 served/(served+pending.length) 现算。
 */
export interface RoundState {
  sessionId: string;
  pending: string[];
  served: number;
  total: number;
  correct: number;
  startedAt: number;
  /** R6/R15：答对后等用户选保留/划去；进程被杀时按「保留」恢复 */
  pendingChoice: { questionId: string; askedAt: number } | null;
  finishedAt: number | null;
}
