import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ToneText, TonePinyin } from './ToneText.jsx'
import { isSpeechSupported, speak, getPreferredVoice } from '../utils/speech.js'
import { packProgress } from '../utils/progress.js'

// --- Answer matching -------------------------------------------------------
function normalize(s) {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'"()]/g, '')
}

// Accept any of the stored alternatives (split on , / ; or the word "or"),
// and tolerate a leading "to " (verbs) or article (a/an/the).
function acceptedAnswers(english) {
  const raw = String(english).split(/[,/;]|\bor\b/i)
  const set = new Set()
  for (const part of raw) {
    const n = normalize(part)
    if (!n) continue
    set.add(n)
    set.add(n.replace(/^to /, ''))
    set.add(n.replace(/^(a|an|the) /, ''))
  }
  return set
}

function checkAnswer(userAnswer, english) {
  const u = normalize(userAnswer)
  if (!u) return false
  const variants = new Set([u, u.replace(/^to /, ''), u.replace(/^(a|an|the) /, '')])
  const accepted = acceptedAnswers(english)
  for (const v of variants) if (accepted.has(v)) return true
  return false
}

export default function QuizMode({
  words,
  initialIndex = 0,
  initialResults = [],
  onFinish,
  onExit,
}) {
  const { state, dispatch } = useApp()
  const [index, setIndex] = useState(initialIndex)
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState('answering') // 'answering' | 'checked'
  const [lastCorrect, setLastCorrect] = useState(false)
  const [results, setResults] = useState(initialResults)
  const [showHint, setShowHint] = useState(state.settings.showPinyinHint)
  const inputRef = useRef(null)
  // Mirrors `status` synchronously so a double key-press can't submit or
  // advance twice within the same tick (state updates are async).
  const statusRef = useRef('answering')
  // Lets the window key handler call the latest `advance` without TDZ issues.
  const advanceRef = useRef(null)

  const current = words[index]
  const total = words.length

  // Focus the input on each new question.
  useEffect(() => {
    inputRef.current?.focus()
  }, [index])

  // Alt+H toggles the pinyin hint (works even while typing the answer).
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault()
        setShowHint((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Once an answer is checked the input is disabled, so Enter can't reach it.
  // Listen on the window so Enter still advances (and finishes the last one).
  useEffect(() => {
    if (status !== 'checked') return
    const onKey = (e) => {
      if (e.key !== 'Enter') return
      // A focused button already fires its own click on Enter — don't double up.
      if (e.target instanceof HTMLButtonElement) return
      e.preventDefault()
      advanceRef.current?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status])

  if (!current) return null

  const submit = () => {
    if (statusRef.current !== 'answering') return
    statusRef.current = 'checked'
    const correct = checkAnswer(answer, current.english)
    setLastCorrect(correct)
    setStatus('checked')
    dispatch({ type: 'GRADE_WORD', id: current.id, correct })
    setResults((r) => [...r, { word: current, correct, userAnswer: answer.trim() }])
  }

  const advance = () => {
    if (statusRef.current !== 'checked') return
    statusRef.current = 'answering'
    const nextIndex = index + 1
    if (nextIndex >= total) {
      dispatch({ type: 'CLEAR_PROGRESS', mode: 'quiz' })
      onFinish({ mode: 'quiz', results: [...results] })
      return
    }
    dispatch({
      type: 'SAVE_PROGRESS',
      mode: 'quiz',
      progress: packProgress({ words, index: nextIndex, results }),
    })
    setIndex(nextIndex)
    setAnswer('')
    setStatus('answering')
  }

  advanceRef.current = advance

  // Enter submits the answer. The input is disabled once checked, so it can no
  // longer receive keys — the window listener above handles advancing.
  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ProgressHeader index={index} total={total} onExit={onExit} title="Translation Quiz" />

      <div className="card p-6 sm:p-8">
        {/* Prompt */}
        <div className="text-center">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Translate to English
          </div>
          <div key={current.id} className="animate-pop flex items-center justify-center gap-3">
            <ToneText hanzi={current.hanzi} pinyin={current.pinyin} className="text-6xl font-bold sm:text-7xl" />
            {isSpeechSupported() && (
              <button
                className="btn-ghost !p-2"
                title="Hear it"
                onClick={() =>
                  speak(current.hanzi, {
                    rate: state.settings.dictation.rate,
                    voice: getPreferredVoice(state.settings.dictation.voiceURI),
                  })
                }
              >
                <SpeakerIcon />
              </button>
            )}
          </div>

          {/* Toggleable pinyin hint */}
          <div className="mt-3 h-6">
            {showHint && current.pinyin ? (
              <TonePinyin pinyin={current.pinyin} className="text-lg font-medium" />
            ) : (
              <span className="text-sm text-slate-300">· · ·</span>
            )}
          </div>
        </div>

        {/* Answer input */}
        <div className="mt-6">
          <input
            ref={inputRef}
            className={`input text-center text-lg ${
              status === 'checked'
                ? lastCorrect
                  ? 'ring-2 ring-emerald-400 bg-emerald-50'
                  : 'ring-2 ring-red-400 bg-red-50'
                : ''
            }`}
            placeholder="Type the English translation…"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={status === 'checked'}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>

        {/* Feedback */}
        {status === 'checked' && (
          <div
            className={`mt-4 rounded-xl p-4 text-center ${
              lastCorrect ? 'animate-pop bg-emerald-50 text-emerald-800' : 'animate-shake bg-red-50 text-red-800'
            }`}
          >
            <div className="text-lg font-bold">
              {lastCorrect ? '✓ Correct!' : '✗ Not quite'}
            </div>
            {!lastCorrect && (
              <div className="mt-1 text-sm">
                Answer: <span className="font-semibold">{current.english}</span>
              </div>
            )}
            <div className="mt-1 text-sm">
              <TonePinyin pinyin={current.pinyin} /> · {current.english}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mt-6 flex items-center gap-3">
          <button
            className="btn-secondary"
            onClick={() => setShowHint((v) => !v)}
            title="Toggle pinyin hint (Alt+H)"
          >
            {showHint ? 'Hide' : 'Show'} pinyin
          </button>
          {status === 'answering' ? (
            <button className="btn-primary flex-1" onClick={submit}>
              Check <kbd className="ml-1 rounded bg-white/20 px-1 text-xs">Enter</kbd>
            </button>
          ) : (
            <button className="btn-primary flex-1" onClick={advance}>
              {index + 1 >= total ? 'See results' : 'Next'}{' '}
              <kbd className="ml-1 rounded bg-white/20 px-1 text-xs">Enter</kbd>
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-400">
        Press <kbd className="rounded bg-slate-200 px-1">Enter</kbd> to submit &amp; advance ·{' '}
        <kbd className="rounded bg-slate-200 px-1">Alt</kbd>+<kbd className="rounded bg-slate-200 px-1">H</kbd> toggles hint
      </p>
    </div>
  )
}

export function ProgressHeader({ index, total, onExit, title }) {
  const pct = Math.round((index / total) * 100)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button className="btn-ghost !px-2 !py-1 text-sm" onClick={onExit}>
          ← Exit
        </button>
        <span className="text-sm font-medium text-slate-500">
          {title} · {index + 1} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SpeakerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  )
}
