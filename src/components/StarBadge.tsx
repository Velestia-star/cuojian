import styles from './StarBadge.module.css';

/** 星数只做展示（R9）：0 星表示还没练过，不显示五颗空星噪音。 */
export function StarBadge({ stars }: { stars: number }) {
  if (stars <= 0) {
    return <span className={styles.none}>未练</span>;
  }
  return (
    <span className={styles.stars} aria-label={`${Math.min(5, stars)} 星`}>
      {'★'.repeat(Math.min(5, stars))}
      <span className={styles.empty}>{'☆'.repeat(Math.max(0, 5 - stars))}</span>
    </span>
  );
}
