import Dexie, { type EntityTable } from 'dexie';
import type {
  AttemptRow,
  BlankAnswerRow,
  CardRow,
  OptionRow,
  QuestionRow,
  QueueItemRow,
  SessionRow,
  SettingRow,
} from '../types';

/** 预留：v1 用 subject 字符串分组，tag 表先按 R11 建出来，避免以后改 schema。 */
export interface TagRow {
  id: string;
  name: string;
  createdAt: number;
}

export class CuojianDb extends Dexie {
  question!: EntityTable<QuestionRow, 'id'>;
  option!: EntityTable<OptionRow, 'id'>;
  answer!: EntityTable<BlankAnswerRow, 'id'>;
  card!: EntityTable<CardRow, 'questionId'>;
  attempt!: EntityTable<AttemptRow, 'id'>;
  session!: EntityTable<SessionRow, 'id'>;
  tag!: EntityTable<TagRow, 'id'>;
  setting!: EntityTable<SettingRow, 'key'>;
  queue_item!: EntityTable<QueueItemRow, 'questionId'>;

  constructor(name = 'cuojian') {
    super(name);
    // 只在 v1 用一次 version(1)；以后加字段必须新增 version(2) 并写迁移。
    this.version(1).stores({
      question: 'id, kind, archivedAt, createdAt, updatedAt',
      option: 'id, questionId, [questionId+ord]',
      answer: 'id, questionId, [questionId+blankIndex]',
      card: 'questionId, stars, inQueue',
      attempt: 'id, questionId, sessionId, createdAt',
      session: 'id, startedAt',
      tag: 'id, name',
      setting: 'key',
      queue_item: 'questionId, pos',
    });
  }
}

export const db = new CuojianDb();
