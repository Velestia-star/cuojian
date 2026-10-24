import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../app/useAppStore';
import { BlankEditor } from '../components/BlankEditor';
import { ChoiceOptionEditor, type OptionDraft } from '../components/ChoiceOptionEditor';
import { isPositionalLabel } from '../core/positional';
import type { NewQuestionInput, QuestionKind } from '../types';
import styles from './NewQuestionPage.module.css';

const INITIAL_OPTIONS: OptionDraft[] = [
  { text: '', isCorrect: false },
  { text: '', isCorrect: false },
];

const splitAccepts = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export function NewQuestionPage() {
  const createQuestion = useAppStore((s) => s.createQuestion);
  const navigate = useNavigate();

  const [kind, setKind] = useState<QuestionKind>('choice');
  const [stem, setStem] = useState('');
  const [subject, setSubject] = useState('');
  const [explanation, setExplanation] = useState('');
  const [multi, setMulti] = useState(false);
  const [options, setOptions] = useState<OptionDraft[]>(INITIAL_OPTIONS);
  const [manualLock, setManualLock] = useState(false);
  const [blanks, setBlanks] = useState<string[]>(['']);
  const [strict, setStrict] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // R4：出现位置相关选项就锁整题，用户不能反悔（反悔会破坏题目语义）
  const positionalHit = useMemo(
    () => kind === 'choice' && options.some((o) => isPositionalLabel(o.text)),
    [kind, options],
  );
  useEffect(() => {
    if (positionalHit) setManualLock(true);
  }, [positionalHit]);

  const validate = (): string | null => {
    if (!stem.trim()) return '题干不能为空';
    if (kind === 'choice') {
      if (options.length < 2 || options.length > 8) return '选择题需要 2–8 个选项';
      if (options.some((o) => !o.text.trim())) return '每个选项都要填内容';
      const correct = options.filter((o) => o.isCorrect).length;
      if (correct === 0) return '至少标出一个正确选项';
      if (!multi && correct > 1) return '单选题只能有一个正确选项，或者打开多选';
      return null;
    }
    if (blanks.length === 0) return '填空题至少要有 1 个空';
    if (blanks.some((b) => splitAccepts(b).length === 0)) {
      return '每个空至少要写一种可接受答案';
    }
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const message = validate();
    setError(message);
    if (message) return;
    setSaving(true);
    const input: NewQuestionInput = {
      kind,
      stem: stem.trim(),
      explanation: explanation.trim() || null,
      subject: subject.trim() || null,
      difficulty: 3,
      multi: kind === 'choice' && multi,
      shuffleLocked: kind === 'choice' && (manualLock || positionalHit),
      blankStrict: kind === 'blank' && strict,
      ignoreCase: kind === 'blank' ? ignoreCase : true,
      options:
        kind === 'choice'
          ? options.map((o) => ({
              text: o.text.trim(),
              isCorrect: o.isCorrect,
              positional: isPositionalLabel(o.text),
            }))
          : [],
      blanks:
        kind === 'blank' ? blanks.map((b) => ({ accepts: splitAccepts(b) })) : [],
    };
    try {
      await createQuestion(input);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
      setSaving(false);
    }
  };

  return (
    <form className={styles.wrap} onSubmit={(e) => void submit(e)}>
      <div className={styles.head}>
        <h1 className={styles.title}>录入错题</h1>
        <button
          type="button"
          className="btn btnGhost"
          onClick={() => navigate('/')}
          disabled={saving}
        >
          返回题库
        </button>
      </div>

      <div className={styles.switch} role="tablist" aria-label="题型">
        {(['choice', 'blank'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            className={`${styles.tab} ${kind === value ? styles.tabOn : ''}`}
            onClick={() => setKind(value)}
          >
            {value === 'choice' ? '选择题' : '填空题'}
          </button>
        ))}
      </div>

      <label className={styles.field}>
        <span className={styles.label}>题干</span>
        <textarea
          className="textarea"
          value={stem}
          placeholder="把题目原文抄进来，不要写选项字母"
          onChange={(e) => setStem(e.target.value)}
        />
      </label>

      {kind === 'choice' ? (
        <section className={styles.field}>
          <span className={styles.label}>选项</span>
          <ChoiceOptionEditor
            options={options}
            multi={multi}
            onChange={setOptions}
            disabled={saving}
          />
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={multi}
              disabled={saving}
              onChange={(e) => setMulti(e.target.checked)}
            />
            多选
          </label>
          <label className={styles.inline}>
            <input
              type="checkbox"
              checked={manualLock || positionalHit}
              disabled={saving || positionalHit}
              onChange={(e) => setManualLock(e.target.checked)}
            />
            打乱时锁定选项顺序
            {positionalHit ? (
              <span className={styles.warn}>
                检测到「以上都对」这类位置相关选项，已自动锁定
              </span>
            ) : null}
          </label>
        </section>
      ) : (
        <section className={styles.field}>
          <span className={styles.label}>答案</span>
          <BlankEditor
            blanks={blanks}
            strict={strict}
            ignoreCase={ignoreCase}
            disabled={saving}
            onBlanksChange={setBlanks}
            onStrictChange={setStrict}
            onIgnoreCaseChange={setIgnoreCase}
          />
        </section>
      )}

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>学科（可选）</span>
          <input
            className="input"
            value={subject}
            placeholder="数学 / 英语 / 法规"
            onChange={(e) => setSubject(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>解析（可选）</span>
          <input
            className="input"
            value={explanation}
            placeholder="写结论，不要写「选 A」"
            onChange={(e) => setExplanation(e.target.value)}
          />
        </label>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.footer}>
        <span className="hint">
          答案按选项身份保存，不存 A/B/C；打乱顺序不会影响判分。
        </span>
        <button type="submit" className="btn btnPrimary" disabled={saving}>
          {saving ? '保存中…' : '保存题目'}
        </button>
      </div>
    </form>
  );
}
