import { useState } from 'react';
import type { AnswerFeedback } from '../app/store';
import { useAppStore } from '../app/useAppStore';
import type { QuestionBundle } from '../types';
import { OptionList } from './OptionList';
import styles from './AnswerArea.module.css';

interface Props {
  bundle: QuestionBundle;
  feedback: AnswerFeedback | null;
}

/**
 * 作答区。父组件用 key={questionId} 挂载，换题即重挂，
 * 省掉「什么时候该清空选择」的同步逻辑。
 */
export function AnswerArea({ bundle, feedback }: Props) {
  const renderedOptionIds = useAppStore((s) => s.renderedOptionIds);
  const blankTemplate = useAppStore((s) => s.blankInputs);
  const answerChoice = useAppStore((s) => s.answerChoice);
  const answerBlank = useAppStore((s) => s.answerBlank);

  const [picked, setPicked] = useState<readonly string[]>([]);
  const [answers, setAnswers] = useState<string[]>(() => blankTemplate);

  const isChoice = bundle.question.kind === 'choice';
  const disabled = feedback !== null;

  const toggle = (optionId: string): void => {
    if (disabled) return;
    if (bundle.question.multi) {
      setPicked((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
      return;
    }
    setPicked([optionId]);
  };

  const canSubmit = isChoice ? picked.length > 0 : answers.some((a) => a.trim());

  const submit = (): void => {
    if (disabled) return;
    if (isChoice) {
      if (picked.length > 0) void answerChoice(picked);
      return;
    }
    if (answers.some((a) => a.trim())) void answerBlank(answers);
  };

  return (
    <>
      {isChoice ? (
        <OptionList
          options={bundle.options}
          renderedIds={renderedOptionIds}
          picked={picked}
          multi={bundle.question.multi}
          disabled={disabled}
          reveal={disabled}
          onToggle={toggle}
        />
      ) : (
        <div className={styles.blanks}>
          {answers.map((value, index) => (
            <label key={index} className={styles.blankRow}>
              <span className={styles.blankIndex}>空 {index + 1}</span>
              <input
                className="input"
                value={value}
                autoComplete="off"
                disabled={disabled}
                onChange={(e) =>
                  setAnswers(answers.map((a, i) => (i === index ? e.target.value : a)))
                }
              />
            </label>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className="btn btnPrimary"
          disabled={!canSubmit || disabled}
          onClick={submit}
        >
          提交答案
        </button>
        <span className="hint">{isChoice ? (bundle.question.multi ? '多选题' : '单选题') : '每空都要填'}</span>
      </div>
    </>
  );
}
