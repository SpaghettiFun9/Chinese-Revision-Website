import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import { loadState, saveState, uid } from '../utils/storage.js'
import { newSrs, gradeSrs, clearReview } from '../utils/srs.js'

const AppContext = createContext(null)

// ---- Seed data (only used the very first time, when storage is empty) -------
function seedState() {
  const foodId = uid('topic')
  const greetId = uid('topic')
  const mk = (hanzi, pinyin, english, topicId) => ({
    id: uid('word'),
    hanzi,
    pinyin,
    english,
    topicId,
    srs: newSrs(),
  })
  return {
    topics: [
      { id: foodId, name: 'Food 食物' },
      { id: greetId, name: 'Greetings 问候' },
    ],
    words: [
      mk('米饭', 'mǐ fàn', 'rice', foodId),
      mk('面条', 'miàn tiáo', 'noodles', foodId),
      mk('鸡蛋', 'jī dàn', 'egg', foodId),
      mk('苹果', 'píng guǒ', 'apple', foodId),
      mk('水', 'shuǐ', 'water', foodId),
      mk('你好', 'nǐ hǎo', 'hello', greetId),
      mk('谢谢', 'xiè xie', 'thank you', greetId),
      mk('再见', 'zài jiàn', 'goodbye', greetId),
      mk('对不起', 'duì bu qǐ', 'sorry', greetId),
    ],
    settings: {
      dictation: { interval: 8, repeats: 2, rate: 0.9, voiceURI: '' },
      showPinyinHint: false,
    },
  }
}

function init() {
  const saved = loadState()
  if (saved && saved.topics && saved.words && saved.settings) {
    // Backfill srs for any words missing it (forward-compat).
    saved.words = saved.words.map((w) => ({ ...w, srs: w.srs || newSrs() }))
    // Backfill newer settings fields added after this state was first saved.
    const seed = seedState().settings
    const { ai, ...rest } = saved.settings // drop the removed AI-import settings
    saved.settings = {
      ...seed,
      ...rest,
      dictation: { ...seed.dictation, ...(rest.dictation || {}) },
    }
    return saved
  }
  return seedState()
}

function reducer(state, action) {
  switch (action.type) {
    // ---- Topics -----------------------------------------------------------
    case 'ADD_TOPIC': {
      const name = action.name.trim()
      if (!name) return state
      return { ...state, topics: [...state.topics, { id: uid('topic'), name }] }
    }
    case 'RENAME_TOPIC':
      return {
        ...state,
        topics: state.topics.map((t) =>
          t.id === action.id ? { ...t, name: action.name.trim() || t.name } : t,
        ),
      }
    case 'DELETE_TOPIC':
      return {
        ...state,
        topics: state.topics.filter((t) => t.id !== action.id),
        // Orphan the words (topicId → null) rather than deleting them.
        words: state.words.map((w) =>
          w.topicId === action.id ? { ...w, topicId: null } : w,
        ),
      }

    // ---- Words ------------------------------------------------------------
    case 'ADD_WORD': {
      const { hanzi, pinyin, english, topicId } = action.word
      if (!hanzi.trim() || !english.trim()) return state
      return {
        ...state,
        words: [
          ...state.words,
          {
            id: uid('word'),
            hanzi: hanzi.trim(),
            pinyin: pinyin.trim(),
            english: english.trim(),
            topicId: topicId || null,
            srs: newSrs(),
          },
        ],
      }
    }
    case 'ADD_WORDS_BULK': {
      const rows = action.words
        .filter((w) => w.hanzi?.trim() && w.english?.trim())
        .map((w) => ({
          id: uid('word'),
          hanzi: w.hanzi.trim(),
          pinyin: (w.pinyin || '').trim(),
          english: w.english.trim(),
          topicId: action.topicId || null,
          srs: newSrs(),
        }))
      return { ...state, words: [...state.words, ...rows] }
    }
    case 'UPDATE_WORD':
      return {
        ...state,
        words: state.words.map((w) =>
          w.id === action.id ? { ...w, ...action.changes } : w,
        ),
      }
    case 'DELETE_WORD':
      return { ...state, words: state.words.filter((w) => w.id !== action.id) }

    // ---- SRS grading ------------------------------------------------------
    case 'GRADE_WORD':
      return {
        ...state,
        words: state.words.map((w) =>
          w.id === action.id ? { ...w, srs: gradeSrs(w.srs, action.correct) } : w,
        ),
      }
    case 'CLEAR_REVIEW':
      return {
        ...state,
        words: state.words.map((w) =>
          w.id === action.id ? { ...w, srs: clearReview(w.srs) } : w,
        ),
      }
    case 'RESET_SRS':
      return {
        ...state,
        words: state.words.map((w) => ({ ...w, srs: newSrs() })),
      }

    // ---- Settings ---------------------------------------------------------
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } }
    case 'SET_DICTATION_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          dictation: { ...state.settings.dictation, ...action.settings },
        },
      }
    case 'TOGGLE_PINYIN_HINT':
      return {
        ...state,
        settings: { ...state.settings, showPinyinHint: !state.settings.showPinyinHint },
      }

    // ---- Danger zone ------------------------------------------------------
    case 'IMPORT_STATE':
      return action.state
    case 'RESET_ALL':
      return seedState()

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)

  // Persist on every change.
  useEffect(() => {
    saveState(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
