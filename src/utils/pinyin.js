// ---------------------------------------------------------------------------
// Pinyin / tone utilities
// Detects the Mandarin tone of a pinyin syllable, whether it is written with
// diacritics (mā má mǎ mà) or with a trailing tone number (ma1 ma2 ma3 ma4).
// ---------------------------------------------------------------------------

// Every tone-marked vowel mapped to [baseVowel, toneNumber].
const TONE_MARK_MAP = {
  ā: ['a', 1], á: ['a', 2], ǎ: ['a', 3], à: ['a', 4],
  ē: ['e', 1], é: ['e', 2], ě: ['e', 3], è: ['e', 4],
  ī: ['i', 1], í: ['i', 2], ǐ: ['i', 3], ì: ['i', 4],
  ō: ['o', 1], ó: ['o', 2], ǒ: ['o', 3], ò: ['o', 4],
  ū: ['u', 1], ú: ['u', 2], ǔ: ['u', 3], ù: ['u', 4],
  ǖ: ['ü', 1], ǘ: ['ü', 2], ǚ: ['ü', 3], ǜ: ['ü', 4],
  Ā: ['A', 1], Á: ['A', 2], Ǎ: ['A', 3], À: ['A', 4],
  Ē: ['E', 1], É: ['E', 2], Ě: ['E', 3], È: ['E', 4],
  Ō: ['O', 1], Ó: ['O', 2], Ǒ: ['O', 3], Ò: ['O', 4],
}

/**
 * Return the tone number (1-4) for a single pinyin syllable, or 5 for the
 * neutral tone / undetectable. Handles both diacritic and numbered pinyin.
 */
export function getToneNumber(syllable) {
  if (!syllable) return 5
  const s = String(syllable).trim()
  if (!s) return 5

  // Numbered pinyin, e.g. "hao3" or "ma5"
  const numMatch = s.match(/([1-5])\s*$/)
  if (numMatch) {
    const n = Number(numMatch[1])
    return n === 0 || n === 5 ? 5 : n
  }

  // Diacritic pinyin – scan for a tone-marked vowel
  for (const ch of s) {
    if (TONE_MARK_MAP[ch]) return TONE_MARK_MAP[ch][1]
  }

  return 5 // no mark found → treat as neutral
}

/**
 * Convert a numbered pinyin syllable ("hao3") into its diacritic form ("hǎo").
 * If already in diacritic form (or has no number) it is returned unchanged.
 */
const DIACRITICS = {
  a: ['a', 'ā', 'á', 'ǎ', 'à'],
  e: ['e', 'ē', 'é', 'ě', 'è'],
  i: ['i', 'ī', 'í', 'ǐ', 'ì'],
  o: ['o', 'ō', 'ó', 'ǒ', 'ò'],
  u: ['u', 'ū', 'ú', 'ǔ', 'ù'],
  ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
  v: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

export function numberedToDiacritic(syllable) {
  const s = String(syllable || '').trim()
  const m = s.match(/^([a-züv]+)([1-5])$/i)
  if (!m) return s
  let base = m[1]
  const tone = Number(m[2])
  if (tone === 0 || tone === 5) return base.replace(/v/gi, 'ü')

  // Tone-mark placement rules: a/e always take the mark; "ou" → o;
  // otherwise the mark goes on the last vowel.
  const lower = base.toLowerCase()
  let idx
  if (lower.includes('a')) idx = lower.indexOf('a')
  else if (lower.includes('e')) idx = lower.indexOf('e')
  else if (lower.includes('ou')) idx = lower.indexOf('o')
  else {
    idx = -1
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('aeiouüv'.includes(lower[i])) { idx = i; break }
    }
  }
  if (idx < 0) return base.replace(/v/gi, 'ü')

  const vowelKey = lower[idx] === 'v' ? 'ü' : lower[idx]
  const marked = DIACRITICS[vowelKey]?.[tone] || base[idx]
  return (base.slice(0, idx) + marked + base.slice(idx + 1)).replace(/v/gi, 'ü')
}

/** True for a CJK ideograph (a character we should color / count). */
export function isHanzi(ch) {
  const code = ch.codePointAt(0)
  return (
    (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
    (code >= 0x3400 && code <= 0x4dbf) || // Extension A
    (code >= 0xf900 && code <= 0xfaff)    // Compatibility Ideographs
  )
}

/** Tailwind text-color class for a given tone number. */
export function toneColorClass(tone) {
  switch (tone) {
    case 1: return 'text-tone1'
    case 2: return 'text-tone2'
    case 3: return 'text-tone3'
    case 4: return 'text-tone4'
    default: return 'text-tone5'
  }
}

/**
 * Split a hanzi string and its pinyin into aligned, tone-tagged tokens.
 * Non-hanzi characters (punctuation, spaces) are passed through without a tone.
 * Returns: [{ char, tone, isHanzi, pinyin }]
 */
export function tokenizeWithTones(hanzi = '', pinyin = '') {
  const syllables = String(pinyin).trim().split(/\s+/).filter(Boolean)
  const chars = Array.from(String(hanzi))
  let syllableIndex = 0

  return chars.map((char) => {
    if (isHanzi(char)) {
      const syl = syllables[syllableIndex]
      const tone = getToneNumber(syl)
      syllableIndex += 1
      return { char, tone, isHanzi: true, pinyin: syl || '' }
    }
    return { char, tone: null, isHanzi: false, pinyin: '' }
  })
}
