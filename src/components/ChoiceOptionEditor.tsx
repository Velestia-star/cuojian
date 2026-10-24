import { isPositionalLabel } from '../core/positional';
import styles from './ChoiceOptionEditor.module.css';

export interface OptionDraft {
  text: string;
  isCorrect: boolean;
}

interface Props {
  options: OptionDraft[];
  multi: boolean;
  disabled?: boolean;
  onChange: (next: OptionDraft[]) => void;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

/** R1：2–8 个选项；R4：位置相关选项会被标出来，交由父组件锁整题顺序。 */
export function ChoiceOptionEditor({ options, multi, disabled, onChange }: Props) {
  const update = (index: number, patch: Partial<OptionDraft>): void => {
    onChange(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const toggleCorrect = (index: number): void => {
    if (multi) {
      update(index, { isCorrect: !options[index]?.isCorrect });
      return;
    }
    onChange(options.map((o, i) => ({ ...o, isCorrect: i === index })));
  };

  return (
    <div className={styles.wrap}>
      {options.map((option, index) => {
        const positional = isPositionalLabel(option.text);
        return (
          <div key={index} className={styles.row}>
            <button
              type="button"
              className={`${styles.mark} ${option.isCorrect ? styles.markOn : ''}`}
              aria-pressed={option.isCorrect}
              aria-label={`把第 ${index + 1} 项设为${multi ? '正确' : '正确答案'}`}
              disabled={disabled}
              onClick={() => toggleCorrect(index)}
            >
              {String.fromCharCode(65 + index)}
            </button>
            <input
              className={`input ${styles.input}`}
              value={option.text}
              placeholder={`选项 ${index + 1}`}
              disabled={disabled}
              onChange={(e) => update(index, { text: e.target.value })}
            />
            {positional ? <span className={styles.tag}>位置相关</span> : null}
            <button
              type="button"
              className={styles.del}
              aria-label={`删除选项 ${index + 1}`}
              disabled={disabled || options.length <= MIN_OPTIONS}
              onClick={() => onChange(options.filter((_, i) => i !== index))}
            >
              删除
            </button>
          </div>
        );
      })}
      <div className={styles.footer}>
        <button
          type="button"
          className="btn"
          disabled={disabled || options.length >= MAX_OPTIONS}
          onClick={() => onChange([...options, { text: '', isCorrect: false }])}
        >
          + 加选项
        </button>
        <span className="hint">
          {multi ? '多选：点左侧字母切换正误' : '单选：点左侧字母设为正确答案'}
        </span>
      </div>
    </div>
  );
}
