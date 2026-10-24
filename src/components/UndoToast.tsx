import { useEffect } from 'react';
import { UNDO_WINDOW_MS } from '../app/store';
import styles from './UndoToast.module.css';

interface Props {
  /** 被划去的题目摘要，让用户知道撤销的是哪一题 */
  label: string;
  /** 撤销截止时间；换了新的一批撤销目标要重新计时 */
  expiresAt: number;
  onUndo: () => void;
  onExpire: () => void;
}

/** R15：划去后 5 秒可撤销；到点自动收起，撤销按钮随之失效。 */
export function UndoToast({ label, expiresAt, onUndo, onExpire }: Props) {
  useEffect(() => {
    const timer = setTimeout(onExpire, UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [expiresAt, onExpire]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span className={styles.label}>已划去「{label}」</span>
      <button type="button" className={styles.undo} onClick={onUndo}>
        撤销
      </button>
    </div>
  );
}
