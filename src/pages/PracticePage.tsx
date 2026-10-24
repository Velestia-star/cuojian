import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAppStore } from '../app/useAppStore';
import { AnswerArea } from '../components/AnswerArea';
import { AnswerFeedback } from '../components/AnswerFeedback';
import { ProgressBar } from '../components/ProgressBar';
import { UndoToast } from '../components/UndoToast';
import { progressOf } from '../features/practice/engine';
import styles from './PracticePage.module.css';

export function PracticePage() {
  const round = useAppStore((s) => s.round);
  const sessionFinished = useAppStore((s) => s.sessionFinished);
  const viewQuestionId = useAppStore((s) => s.viewQuestionId);
  const viewNonce = useAppStore((s) => s.viewNonce);
  const questions = useAppStore((s) => s.questions);
  const feedback = useAppStore((s) => s.feedback);
  const undo = useAppStore((s) => s.undo);
  const nextQuestion = useAppStore((s) => s.nextQuestion);
  const chooseKeep = useAppStore((s) => s.chooseKeep);
  const chooseArchive = useAppStore((s) => s.chooseArchive);
  const undoArchive = useAppStore((s) => s.undoArchive);
  const clearUndo = useAppStore((s) => s.clearUndo);
  const finishRound = useAppStore((s) => s.finishRound);
  const navigate = useNavigate();

  const bundle = useMemo(
    () => questions.find((b) => b.question.id === viewQuestionId),
    [questions, viewQuestionId],
  );

  // R5：答错不弹窗，短暂反馈后自动出下一题
  useEffect(() => {
    if (!feedback || feedback.isCorrect) return;
    const timer = setTimeout(() => nextQuestion(), 900);
    return () => clearTimeout(timer);
  }, [feedback, nextQuestion]);

  // R13：队列空 / 到 50 题上限 / 用户点结束，统一进结算页
  useEffect(() => {
    if (sessionFinished) navigate('/summary', { replace: true });
  }, [sessionFinished, navigate]);

  if (!round) return <Navigate to="/" replace />;
  if (sessionFinished) return null;
  if (!bundle || !viewQuestionId) return <Navigate to="/" replace />;

  const progress = progressOf(round);

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <ProgressBar served={progress.served} total={progress.total} />
        <button
          type="button"
          className="btn btnGhost"
          onClick={() => void finishRound()}
        >
          结束本轮
        </button>
      </div>

      <article className={styles.card}>
        <div className={styles.meta}>
          <span className={styles.kind}>
            {bundle.question.kind === 'choice' ? '选择题' : '填空题'}
          </span>
          {bundle.question.multi ? <span className={styles.kind}>多选</span> : null}
          {bundle.question.subject ? (
            <span className={styles.subject}>{bundle.question.subject}</span>
          ) : null}
          <span className={styles.spacer} />
          {bundle.question.shuffleLocked ? (
            <span className={styles.lock} title="该题含位置相关选项，整题不打乱">
              顺序锁定
            </span>
          ) : (
            <span className={styles.hint}>选项每次作答重新打乱</span>
          )}
        </div>

        <p className={styles.stem}>{bundle.question.stem}</p>

        <AnswerArea
          key={`${viewQuestionId}-${viewNonce}`}
          bundle={bundle}
          feedback={feedback}
        />
      </article>

      {feedback ? (
        <AnswerFeedback feedback={feedback}>
          {feedback.isCorrect ? (
            <div className={styles.choiceRow}>
              <button type="button" className="btn" onClick={() => void chooseKeep()}>
                保留在错题集
              </button>
              <button
                type="button"
                className="btn btnPrimary"
                onClick={() => void chooseArchive()}
              >
                划去这题
              </button>
              <span className="hint">不选就关掉页面，按「保留」记账</span>
            </div>
          ) : null}
        </AnswerFeedback>
      ) : null}

      {undo ? (
        <UndoToast
          label={labelOf(questions, undo.questionId)}
          expiresAt={undo.expiresAt}
          onUndo={() => void undoArchive()}
          onExpire={clearUndo}
        />
      ) : null}
    </div>
  );
}

function labelOf(
  questions: { question: { id: string; stem: string } }[],
  questionId: string,
): string {
  const stem = questions.find((b) => b.question.id === questionId)?.question.stem ?? '这道题';
  return stem.length > 14 ? `${stem.slice(0, 14)}…` : stem;
}
