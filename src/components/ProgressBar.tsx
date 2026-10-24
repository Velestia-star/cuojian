import styles from './ProgressBar.module.css';

interface Props {
  served: number;
  total: number;
}

/** R13：界面始终显示进度，如 12/30。总数为 0 时不画填充。 */
export function ProgressBar({ served, total }: Props) {
  const percent = total > 0 ? Math.min(100, Math.round((served / total) * 100)) : 0;
  return (
    <div className={styles.wrap}>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={served}
        aria-label="本轮进度"
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.text}>
        {served}/{total}
      </span>
    </div>
  );
}
