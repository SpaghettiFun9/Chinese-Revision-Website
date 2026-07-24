// ---------------------------------------------------------------------------
// SRS Lite
// A lightweight spaced-repetition weighting scheme. Every word carries an srs
// object; words answered incorrectly gain weight and are shown more often,
// words answered correctly lose weight (down to a floor of 1).
// ---------------------------------------------------------------------------

export const MIN_WEIGHT = 1
export const MAX_WEIGHT = 8

/** Default srs record for a brand-new word. */
export function newSrs() {
  return {
    seen: 0,
    correct: 0,
    incorrect: 0,
    weight: 2, // new words start slightly boosted so they get surfaced
    lastResult: null, // 'correct' | 'incorrect' | null
  }
}

/** Return an updated srs record after grading an answer. Pure — no mutation. */
export function gradeSrs(srs, wasCorrect) {
  const base = srs || newSrs()
  const weight = wasCorrect
    ? Math.max(MIN_WEIGHT, base.weight - 1)
    : Math.min(MAX_WEIGHT, base.weight + 2)
  return {
    seen: base.seen + 1,
    correct: base.correct + (wasCorrect ? 1 : 0),
    incorrect: base.incorrect + (wasCorrect ? 0 : 1),
    weight,
    lastResult: wasCorrect ? 'correct' : 'incorrect',
  }
}

/**
 * Build a study queue from a set of words, ordering so that higher-weight
 * (struggling / new) words appear earlier and more frequently. Uses weighted
 * random sampling without replacement so sessions still feel varied.
 */
export function buildQueue(words) {
  const pool = words.map((w) => ({
    word: w,
    weight: Math.max(MIN_WEIGHT, w.srs?.weight ?? MIN_WEIGHT),
  }))
  const queue = []
  while (pool.length) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0)
    let r = Math.random() * total
    let idx = 0
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight
      if (r <= 0) { idx = i; break }
    }
    queue.push(pool[idx].word)
    pool.splice(idx, 1)
  }
  return queue
}
