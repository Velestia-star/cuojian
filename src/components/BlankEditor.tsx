import styles from './BlankEditor.module.css';

interface Props {
  /** 每个元素是一个空的「可接受写法」，一行一种 */
  blanks: string[];
  strict: boolean;
  ignoreCase: boolean;
  disabled?: boolean;
  onBlanksChange: (next: string[]) => void;
  onStrictChange: (strict: boolean) => void;
  onIgnoreCaseChange: (ignoreCase: boolean) => void;
}

const MAX_BLANKS = 8;

/** R10：每空一组可接受答案；严格度与大小写是两个独立开关。 */
export function BlankEditor({
  blanks,
  strict,
  ignoreCase,
  disabled,
  onBlanksChange,
  onStrictChange,
  onIgnoreCaseChange,
}: Props) {
  return (
    <div className={styles.wrap}>
      {blanks.map((value, index) => (
        <div key={index} className={styles.row}>
          <span className={styles.index}>空 {index + 1}</span>
          <textarea
            className={`textarea ${styles.area}`}
            value={value}
            disabled={disabled}
            placeholder={'每行一种可接受写法\n例：鲁迅\n周树人'}
            onChange={(e) =>
              onBlanksChange(blanks.map((b, i) => (i === index ? e.target.value : b)))
            }
          />
          <button
            type="button"
            className={styles.del}
            aria-label={`删除第 ${index + 1} 个空`}
            disabled={disabled || blanks.length <= 1}
            onClick={() => onBlanksChange(blanks.filter((_, i) => i !== index))}
          >
            删除
          </button>
        </div>
      ))}
      <div className={styles.footer}>
        <button
          type="button"
          className="btn"
          disabled={disabled || blanks.length >= MAX_BLANKS}
          onClick={() => onBlanksChange([...blanks, ''])}
        >
          + 加一个空
        </button>
      </div>
      <div className={styles.switches}>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={strict}
            disabled={disabled}
            onChange={(e) => onStrictChange(e.target.checked)}
          />
          <span>
            严格判定
            <span className="hint">（不折叠空白、忽略标点、不做 1/2 = 0.5 的等价）</span>
          </span>
        </label>
        <label className={styles.switch}>
          <input
            type="checkbox"
            checked={ignoreCase}
            disabled={disabled}
            onChange={(e) => onIgnoreCaseChange(e.target.checked)}
          />
          <span>
            忽略大小写
            <span className="hint">（化学式、物理量请关掉）</span>
          </span>
        </label>
      </div>
    </div>
  );
}
