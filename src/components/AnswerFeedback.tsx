import type { ReactNode } from 'react';
import type { AnswerFeedback as Feedback } from '../app/store';
import styles from './AnswerFeedback.module.css';

interface Props {
  feedback: Feedback;
  /** 答对时显示二选一按钮，答错时只做短暂反馈 */
  children?: ReactNode;
}

export function AnswerFeedback({ feedback, children }: Props) {
  const className = feedback.isCorrect ? styles.right : styles.wrong;
  return (
    <div className={`${styles.banner} ${className}`} role="status" aria-live="polite">
      <div className={styles.head}>
        <strong>{feedback.isCorrect ? '答对了' : '答错了'}</strong>
        {feedback.isCorrect ? null : (
          <span className={styles.next}>马上出下一题</span>
        )}
      </div>
      <p className={styles.line}>
        <span className={styles.k}>正确答案</span>
        {feedback.correctText}
      </p>
      {feedback.userText ? (
        <p className={styles.line}>
          <span className={styles.k}>你的作答</span>
          {feedback.userText}
        </p>
      ) : null}
      {children}
    </div>
  );
}
