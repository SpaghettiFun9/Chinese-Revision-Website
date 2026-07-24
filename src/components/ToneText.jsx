import { tokenizeWithTones, toneColorClass, numberedToDiacritic, getToneNumber } from '../utils/pinyin.js'

/**
 * Render Chinese characters with per-character tone color-coding.
 *  <ToneText hanzi="你好" pinyin="nǐ hǎo" />
 */
export function ToneText({ hanzi, pinyin = '', className = '' }) {
  const tokens = tokenizeWithTones(hanzi, pinyin)
  return (
    <span className={`font-hanzi ${className}`}>
      {tokens.map((t, i) =>
        t.isHanzi ? (
          <span key={i} className={toneColorClass(t.tone)}>
            {t.char}
          </span>
        ) : (
          <span key={i}>{t.char}</span>
        ),
      )}
    </span>
  )
}

/**
 * Render pinyin with each syllable colored by its tone (diacritic form).
 *  <TonePinyin pinyin="ni3 hao3" />  →  nǐ hǎo (colored)
 */
export function TonePinyin({ pinyin = '', className = '' }) {
  const syllables = String(pinyin).trim().split(/\s+/).filter(Boolean)
  if (!syllables.length) return null
  return (
    <span className={className}>
      {syllables.map((syl, i) => {
        const tone = getToneNumber(syl)
        return (
          <span key={i} className={toneColorClass(tone)}>
            {numberedToDiacritic(syl)}
            {i < syllables.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </span>
  )
}
