/**
 * 选择题判定：正确项与所选项按「选项 id 集合」比较。
 * 顺序无关、重复项按集合语义忽略；漏选/多选/空选都算错。
 * 绝不出现 A/B/C 字母——字母是渲染时按顺序现算的。
 */
export function gradeChoice(
  correctOptionIds: readonly string[],
  pickedOptionIds: readonly string[],
): boolean {
  const correct = new Set(correctOptionIds);
  const picked = new Set(pickedOptionIds);
  // 空选永远算错：否则「正确集为空 + 没选」会被集合相等判成对
  if (correct.size === 0 || picked.size === 0) return false;
  if (correct.size !== picked.size) return false;
  for (const id of picked) {
    if (!correct.has(id)) return false;
  }
  return true;
}

// 零宽字符用户看不见，却能造成「看着一样但比较不等」，先删掉。
const ZERO_WIDTH_RE = /[\u200B-\u200F\u2028\u2029\uFEFF]/g;
// 宽松模式容忍句末标点差异；NFKC 已把多数全角标点转半角，两套都写以便直读。
const TRAILING_PUNCT_RE = /[。．.;；,，、!?！？]+$/;

/**
 * 填空归一化。顺序是固定契约，改动会改变历史判定的可比性：
 * NFKC → 删零宽 → 空白处理 → 大小写 → 句末标点。
 * strict = 保留单个空格并 trim，且不去标点；宽松 = 删掉全部空白并去句末标点。
 * 大小写由 ignoreCase 单独控制（化学/物理传 false），不与 strict 混成一个开关。
 */
export function normalizeBlank(input: string, strict: boolean, ignoreCase: boolean = false): string {
  let text = input.normalize('NFKC');
  text = text.replace(ZERO_WIDTH_RE, '');
  text = strict ? text.replace(/\s+/g, ' ').trim() : text.replace(/\s+/g, '');
  if (ignoreCase) text = text.toLowerCase();
  if (!strict) text = text.replace(TRAILING_PUNCT_RE, '');
  return text;
}

// 严格解析：整数 / 小数 / 分数 / 百分数，别的（含指数、千分位）一律不认。
// 这样 1.5 永远不会被当成 15——绝不走「删掉一切非数字」的路子。
const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const FRACTION_RE = /^([+-]?\d+)\/([+-]?\d+)$/;
const PERCENT_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))%$/;

/** 数值化；不是数值返回 null（调用方据此跳过数值等价）。 */
function toNumber(text: string): number | null {
  const percent = PERCENT_RE.exec(text);
  if (percent !== null) {
    const value = Number(percent[1]);
    return Number.isFinite(value) ? value / 100 : null;
  }
  const fraction = FRACTION_RE.exec(text);
  if (fraction !== null) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    return numerator / denominator;
  }
  if (DECIMAL_RE.test(text)) {
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

/**
 * 填空判定：任一可接受写法命中即对（如 鲁迅 / 周树人）。
 * 空输入一律判错；数值等价只在宽松模式生效。
 */
export function gradeBlank(
  accepts: readonly string[],
  input: string,
  strict: boolean,
  ignoreCase: boolean = false,
): boolean {
  const normalizedInput = normalizeBlank(input, strict, ignoreCase);
  if (normalizedInput === '') return false;
  const inputNumber = toNumber(normalizedInput);
  for (const accept of accepts) {
    const normalizedAccept = normalizeBlank(accept, strict, ignoreCase);
    // 空的可接受写法是脏数据，不能让空输入蒙混过关
    if (normalizedAccept === '') continue;
    if (normalizedAccept === normalizedInput) return true;
    if (strict) continue;
    const acceptNumber = toNumber(normalizedAccept);
    if (acceptNumber === null || inputNumber === null) continue;
    if (Math.abs(acceptNumber - inputNumber) <= 1e-9) return true;
  }
  return false;
}
