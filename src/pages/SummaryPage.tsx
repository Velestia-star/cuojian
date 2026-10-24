import { Navigate, useNavigate } from 'react-router-dom';
import { useAppStore } from '../app/useAppStore';
import styles from './SummaryPage.module.css';

export function SummaryPage() {
  const round = useAppStore((s) => s.round);
  const questions = useAppStore((s) => s.questions);
  const startPractice = useAppStore((s) => s.startPractice);
  const navigate = useNavigate();

  if (!round || round.finishedAt === null) return <Navigate to="/" replace />;

  const wrong = round.served - round.correct;
  const accuracy = round.served > 0 ? Math.round((round.correct / round.served) * 100) : 0;
  const pool = questions.filter((b) => b.question.archivedAt === null).length;

  const again = async (): Promise<void> => {
    await startPractice();
    navigate('/practice');
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>本轮结束</h1>
        <p className={styles.sub}>
          一轮的开始是整池打乱，之后答错的题会排队尾，隔几题再回来。
        </p>
      </header>

      <div className={styles.grid}>
        <div className={styles.stat}>
          <span className={styles.num}>{round.served}</span>
          <span className={styles.label}>已作答</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.num}>{round.correct}</span>
          <span className={styles.label}>答对</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.num}>{wrong}</span>
          <span className={styles.label}>答错</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.num}>{accuracy}%</span>
          <span className={styles.label}>正确率</span>
        </div>
      </div>

      {round.pending.length > 0 ? (
        <p className={styles.note}>
          还有 {round.pending.length} 道题没轮到。下次开始新的一轮会重新整池打乱。
        </p>
      ) : (
        <p className={styles.note}>队列已经走完，所有题都过了一遍。</p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={pool === 0}
          onClick={() => void again()}
        >
          再来一轮
        </button>
        <button type="button" className="btn" onClick={() => navigate('/')}>
          回题库
        </button>
      </div>
    </div>
  );
}
