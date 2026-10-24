import { optionLetters } from '../core/shuffle';
import type { OptionRow } from '../types';
import styles from './OptionList.module.css';

interface Props {
  options: OptionRow[];
  /** R3：本次作答的渲染顺序，字母按它现算 */
  renderedIds: readonly string[];
  picked: readonly string[];
  multi: boolean;
  disabled: boolean;
  /** 判完题才揭示正确答案 */
  reveal: boolean;
  onToggle: (optionId: string) => void;
}

export function OptionList({
  options,
  renderedIds,
  picked,
  multi,
  disabled,
  reveal,
  onToggle,
}: Props) {
  const byId = new Map(options.map((o) => [o.id, o]));
  const letters = optionLetters(renderedIds.length);
  return (
    <div className={styles.list} role={multi ? 'group' : 'radiogroup'} aria-label="选项">
      {renderedIds.map((id, index) => {
        const option = byId.get(id);
        if (!option) return null;
        const checked = picked.includes(id);
        const isRight = reveal && option.isCorrect;
        const isWrongPick = reveal && checked && !option.isCorrect;
        const className = [
          styles.option,
          checked ? styles.checked : '',
          isRight ? styles.correct : '',
          isWrongPick ? styles.wrong : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={id}
            type="button"
            className={className}
            disabled={disabled}
            aria-pressed={checked}
            onClick={() => onToggle(id)}
          >
            <span className={styles.letter}>{letters[index] ?? '?'}</span>
            <span className={styles.text}>{option.text}</span>
          </button>
        );
      })}
    </div>
  );
}
