// ---------------------------------------------------------------------------
// Resumable sessions
//
// An in-progress quiz/dictation is stored by word *id* rather than by value, so
// that edits made between sessions are picked up and deleted words simply drop
// out. Restoring re-resolves those ids against the current word list.
// ---------------------------------------------------------------------------

/** Serialize a live session into something we can persist. */
export function packProgress({ words, index, results }) {
  return {
    wordIds: words.map((w) => w.id),
    index,
    results: results.map((r) => ({
      wordId: r.word.id,
      correct: r.correct,
      userAnswer: r.userAnswer ?? '',
    })),
    savedAt: Date.now(),
  }
}

/**
 * Rebuild a session from saved progress against the current word list.
 * Returns null when nothing usable is left (e.g. every word was deleted, or
 * the session had actually reached the end).
 */
export function unpackProgress(progress, allWords) {
  if (!progress?.wordIds?.length) return null
  const byId = new Map(allWords.map((w) => [w.id, w]))

  const words = progress.wordIds.map((id) => byId.get(id)).filter(Boolean)
  if (!words.length) return null

  // Words deleted *before* the saved position would shift it, so recompute the
  // index from how many of the already-answered ids still exist.
  const index = progress.wordIds
    .slice(0, progress.index)
    .filter((id) => byId.has(id)).length
  if (index >= words.length) return null // nothing left to answer

  const results = (progress.results || [])
    .map((r) => ({
      word: byId.get(r.wordId),
      correct: r.correct,
      userAnswer: r.userAnswer,
    }))
    .filter((r) => r.word)

  return { words, index, results }
}

/** How many words remain in a saved session (for the dashboard label). */
export function progressLabel(progress, allWords) {
  const restored = unpackProgress(progress, allWords)
  if (!restored) return null
  return { done: restored.index, total: restored.words.length }
}
