// ---------------------------------------------------------------------------
// LocalStorage persistence helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'chinese-revision-app:v1'

/** Load the persisted app state, or null if none / unreadable. */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.warn('Failed to load saved state:', err)
    return null
  }
}

/** Persist the app state. Silently ignores quota / serialization errors. */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Failed to save state:', err)
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (err) {
    console.warn('Failed to clear state:', err)
  }
}

/** Small unique id generator (good enough for local data). */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
