// ---------------------------------------------------------------------------
// Web Speech API (TTS) helpers for Mandarin (zh-CN)
//
// The browser can only speak with voices already installed on the device, so
// "use a clearer, more human voice" means: rank the available Chinese voices
// and pick the best one automatically (and let the user override). The most
// natural options are network/neural voices — e.g. Chrome's "Google 普通话
// (中国大陆)" — and premium/enhanced OS voices on macOS/iOS.
// ---------------------------------------------------------------------------

export function isSpeechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  )
}

function getRawVoices() {
  if (!isSpeechSupported()) return []
  return window.speechSynthesis.getVoices() || []
}

/**
 * Score a voice for Mandarin naturalness. Higher is better.
 * Network/neural/premium voices sound markedly more human than the default
 * local ones, so they win.
 */
export function scoreVoice(v) {
  if (!v) return -1
  let score = 0
  const lang = v.lang || ''
  const name = v.name || ''

  if (/^zh(-|_)?CN/i.test(lang)) score += 6
  else if (/^zh(-|_)?(TW|HK|SG)/i.test(lang)) score += 3
  else if (/^zh/i.test(lang)) score += 4
  else if (/(chinese|mandarin|putonghua|普通话|中文|國語|国语)/i.test(name)) score += 2
  else return -1 // not a Chinese voice

  // Quality signals in the voice name.
  if (/google/i.test(name)) score += 6 // Chrome's online neural voice — very natural
  if (/(neural|natural|premium|enhanced)/i.test(name)) score += 5
  if (/siri/i.test(name)) score += 4
  if (/(meijia|tingting|sinji|li-?mu|yu-?shu|hanhan|zhiyu|xiaoxiao)/i.test(name)) score += 2

  // Online voices (localService === false) are usually higher fidelity.
  if (v.localService === false) score += 3

  return score
}

/** All Chinese-capable voices, best first. */
export function listChineseVoices() {
  return getRawVoices()
    .map((v) => ({ v, s: scoreVoice(v) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.v)
}

/** The single best Chinese voice, or null. */
export function pickChineseVoice() {
  return listChineseVoices()[0] || null
}

/**
 * Resolve the voice to use: the user's chosen voiceURI if it's still available,
 * otherwise the best-ranked Chinese voice.
 */
export function getPreferredVoice(voiceURI) {
  if (voiceURI) {
    const match = getRawVoices().find((v) => v.voiceURI === voiceURI)
    if (match) return match
  }
  return pickChineseVoice()
}

/**
 * Voices load asynchronously in some browsers. Resolve once they're available
 * (or immediately if already loaded / after a short timeout).
 */
export function ensureVoicesLoaded(timeout = 2000) {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) return resolve([])
    const existing = getRawVoices()
    if (existing.length) return resolve(existing)

    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve(getRawVoices())
    }
    window.speechSynthesis.onvoiceschanged = finish
    setTimeout(finish, timeout)
  })
}

/**
 * Speak a phrase in Mandarin. Resolves when the utterance finishes (or errors,
 * which we treat as a soft finish so a flow never hangs).
 * @param {string} text
 * @param {{ rate?: number, pitch?: number, voice?: SpeechSynthesisVoice }} opts
 */
export function speak(text, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!isSpeechSupported()) {
      reject(new Error('Speech synthesis not supported'))
      return
    }
    try {
      window.speechSynthesis.cancel() // stop anything currently playing
      const u = new SpeechSynthesisUtterance(text)
      const voice = opts.voice || pickChineseVoice()
      if (voice) u.voice = voice
      // Match the utterance language to the chosen voice for correct pronunciation.
      u.lang = voice?.lang || 'zh-CN'
      u.rate = opts.rate ?? 0.9
      u.pitch = opts.pitch ?? 1
      u.onend = () => resolve()
      u.onerror = () => resolve() // don't hard-fail the flow on a single error
      window.speechSynthesis.speak(u)
    } catch (err) {
      reject(err)
    }
  })
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}
