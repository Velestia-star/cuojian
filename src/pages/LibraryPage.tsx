import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../app/useAppStore';
import { StarBadge } from '../components/StarBadge';
import styles from './LibraryPage.module.css';

const dateFmt = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' });

export function LibraryPage() {
  const questions = useAppStore((s) => s.questions);
  const round = useAppStore((s) => s.round);
  const sessionFinished = useAppStore((s) => s.sessionFinished);
  const busy = useAppStore((s) => s.busy);
  const startPractice = useAppStore((s) => s.startPractice);
  const archiveQuestion = useAppStore((s) => s.archiveQuestion);
  const restoreQuestion = useAppStore((s) => s.restoreQuestion);
  const navigate = useNavigate();

  const pool = questions.filter((b) => b.question.archivedAt === null);
  const archived = questions.filter((b) => b.question.archivedAt !== null);
  const resumable = round !== null && !sessionFinished;

  const start = async (): Promise<void> => {
    await startPractice();
    navigate('/practice');
  };

  if (questions.length === 0) {
    return (
      <div className={styles.empty}>
        <h1 className={styles.emptyTitle}>错笺</h1>
        <p className={styles.emptyText}>
          把错题记下来、排好队、反复磨。数据只存在这台设备的浏览器里。
        </p>
        <p className={styles.emptyHint}>
          先录 2–3 道题试试：选择题会每次打乱选项，答错的题会自动排回队尾。
        </p>
        <Link to="/new" className="btn btnPrimary">
          录入第一道错题
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.title}>错笺</h1>
          <p className={styles.sub}>
            共 {questions.length} 题 · 在池 {pool.length} · 已划去 {archived.length}
          </p>
        </div>
        <div className={styles.actions}>
          {resumable ? (
            <button
              type="button"
              className="btn btnPrimary"
              onClick={() => navigate('/practice')}
            >
              继续练习
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${resumable ? '' : 'btnPrimary'}`}
            disabled={pool.length === 0 || busy}
            onClick={() => void start()}
          >
            {resumable ? '重新开一轮' : '开始练习'}
          </button>
          <Link to="/new" className="btn">
            + 录入
          </Link>
        </div>
      </section>

      <ul className={styles.list}>
        {questions.map(({ question, options, blanks, card }) => {
          const isArchived = question.archivedAt !== null;
          return (
            <li key={question.id} className={`${styles.item} ${isArchived ? styles.itemArchived : ''}`}>
              <div className={styles.head}>
                <span className={styles.kind}>
                  {question.kind === 'choice' ? '选择' : '填空'}
                </span>
                {question.multi ? <span className={styles.kind}>多选</span> : null}
                {question.shuffleLocked ? (
                  <span className={styles.lock} title="含位置相关选项，整题不打乱">
                    锁定顺序
                  </span>
                ) : null}
                {question.subject ? (
                  <span className={styles.subject}>{question.subject}</span>
                ) : null}
                <span className={styles.spacer} />
                <StarBadge stars={card.stars} />
                <span className={styles.count}>错 {card.wrongCount} 次</span>
              </div>

              <p className={styles.stem}>{question.stem}</p>

              <div className={styles.foot}>
                <span className={styles.meta}>
                  {question.kind === 'choice'
                    ? `${options.length} 个选项`
                    : `${new Set(blanks.map((b) => b.blankIndex)).size} 个空`}
                  {' · '}
                  {dateFmt.format(new Date(question.updatedAt))}
                  {isArchived ? ' · 已划去' : ''}
                </span>
                <button
                  type="button"
                  className="btn btnGhost"
                  onClick={() =>
                    void (isArchived
                      ? restoreQuestion(question.id)
                      : archiveQuestion(question.id))
                  }
                >
                  {isArchived ? '恢复' : '划去'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
