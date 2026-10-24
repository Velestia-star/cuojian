/** 位置相关选项：含义取决于它在渲染顺序里的位置，因此整题锁定不打乱。 */

// 先只留字母/数字/汉字再匹配：空格、标点、全角符号、零宽字符都不参与语义。
const DROP_NON_WORD = /[^\p{L}\p{N}]+/gu;

// 逐层剥掉「以上 / 上述 / 全部 / 都 / 三种 / 说法 …」这类修饰，剩下判断词才算命中。
// 顺序敏感：长的、具体的写在前面，避免「全都」被「全」抢先吃掉。
const STRIP_RULES: readonly RegExp[] = [
  /^(?:以上|上述)/,
  /^(?:所有|全部|全都|各项|这些|那些|这|那)/,
  /^全/,
  /^都/,
  /^(?:\d+|[一二三四五六七八九十两几多]+)(?:种|个|项)/,
  /^(?:说法|选项|答案|内容|陈述|判断|结论|项目|情况|句子)/,
  /^的/,
];

// 判断词：「都/均/全都/全 + 是 + 对/正确/错/错误/不对/不正确 + 的」。
const VERDICT_RE = /^(?:都|均|全都|全)?(?:是)?(?:对|正确|错|错误|不对|不正确)(?:的)?$/;

// 英文常见写法：All/None of the above…
const EN_POSITIONAL_RE = /^(?:all|none|neither|both|any)of(?:the)?(?:above|these|them)$/;

/** 剥掉一段前缀/修饰；剥不动返回 null。 */
function stripLeading(text: string): string | null {
  for (const rule of STRIP_RULES) {
    const matched = rule.exec(text);
    if (matched !== null) return text.slice(matched[0].length);
  }
  return null;
}

/**
 * 判断选项文本是否是「以上都对」这类位置相关选项。
 * 口径偏保守：必须带位置前缀（以上/上述/全部/都…）且剩下判断词，
 * 所以「以上三种说法」「A、B都对」不会被误判；带量词的「以上三种说法都正确」仍能命中。
 */
export function isPositionalLabel(text: string): boolean {
  const normalized = text.normalize('NFKC').replace(DROP_NON_WORD, '').toLowerCase();
  if (normalized === '') return false;
  if (EN_POSITIONAL_RE.test(normalized)) return true;

  let rest = normalized;
  let stripped = false;
  // 最多剥 6 层，够覆盖「以上 + 三种 + 说法 + 都」；上界也防止任何意外死循环
  for (let step = 0; step < 6; step += 1) {
    const next = stripLeading(rest);
    if (next === null) break;
    stripped = true;
    rest = next;
    if (rest === '') break;
  }
  // 必须真的剥掉过前缀：否则单独的「对」「正确」只是普通选项
  return stripped && VERDICT_RE.test(rest);
}
