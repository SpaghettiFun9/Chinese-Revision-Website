import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ToneText, TonePinyin } from './ToneText.jsx'
import { ProgressHeader } from './QuizMode.jsx'
import Select from './ui/Select.jsx'
import Segmented from './ui/Segmented.jsx'
import { packProgress } from '../utils/progress.js'
import {
  isSpeechSupported,
  ensureVoicesLoaded,
  listChineseVoices,
  getPreferredVoice,
  speak,
  stopSpeaking,
} from '../utils/speech.js'

export default function DictationMode({
  words,
  initialIndex = 0,
  initialResults = [],
  onFinish,
  onExit,
}) {
  const { state, dispatch } = useApp()
  const cfg = state.settings.dictation

  const [index, setIndex] = useState(initialIndex)
  const [phase, setPhase] = useState('idle') // idle | speaking | writing | reveal | done
  const [repeatNum, setRepeatNum] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [reveal, setReveal] = useState(false)
  const [awaitingGrade, setAwaitingGrade] = useState(false)
  const [ttsSupported] = useState(isSpeechSupported())
  const [voiceReady, setVoiceReady] = useState(false)
  const [noVoiceWarning, setNoVoiceWarning] = useState(false)
  const [voices, setVoices] = useState([]) // available Chinese voices, best first

  // Flow-control refs (kept out of React state so async loops read live values).
  const tokenRef = useRef(0)
  const pausedRef = useRef(false)
  const skipRef = useRef(false)
  const voiceRef = useRef(null)
  const resultsRef = useRef([...initialResults])
  const decisionRef = useRef(null) // resolve fn for the "did you get it right?" wait

  // Load voices up front so the first word speaks immediately.
  useEffect(() => {
    if (!ttsSupported) return
    ensureVoicesLoaded().then(() => {
      const zh = listChineseVoices()
      setVoices(zh)
      voiceRef.current = getPreferredVoice(cfg.voiceURI)
      setVoiceReady(true)
      if (!voiceRef.current) setNoVoiceWarning(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsSupported])

  // Keep the active voice in sync when the user changes the preference.
  useEffect(() => {
    if (ttsSupported && voiceReady) voiceRef.current = getPreferredVoice(cfg.voiceURI)
  }, [cfg.voiceURI, ttsSupported, voiceReady])

  // Cleanup on unmount: cancel the running loop, release any pending wait,
  // and stop speech.
  useEffect(() => {
    return () => {
      tokenRef.current += 1
      settleDecision()
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Self-check gate -----------------------------------------------------
  // The reveal step blocks here until the user answers (or skips). There is no
  // timer: the answer stays on screen for as long as they need.
  const waitForDecision = () =>
    new Promise((resolve) => {
      decisionRef.current = resolve
    })

  const settleDecision = () => {
    const resolve = decisionRef.current
    decisionRef.current = null
    if (resolve) resolve()
  }

  // --- Interruptible countdown (honors pause, skip and cancellation) -------
  const sleepWithCountdown = (seconds, token) =>
    new Promise((resolve) => {
      let remaining = seconds * 1000
      setCountdown(Math.ceil(remaining / 1000))
      const step = 100
      const id = setInterval(() => {
        if (tokenRef.current !== token || skipRef.current) {
          clearInterval(id)
          resolve()
          return
        }
        if (pausedRef.current) return // frozen while paused
        remaining -= step
        setCountdown(Math.max(0, Math.ceil(remaining / 1000)))
        if (remaining <= 0) {
          clearInterval(id)
          resolve()
        }
      }, step)
    })

  const speakWord = (word, token) =>
    new Promise((resolve) => {
      if (!ttsSupported) {
        resolve()
        return
      }
      speak(word.hanzi, { rate: cfg.rate, voice: voiceRef.current })
        .then(resolve)
        .catch(resolve)
      // If cancelled mid-speech, the utterance's onend/onerror resolves us.
      void token
    })

  // --- The main pacing loop ------------------------------------------------
  const run = async (startIndex) => {
    const token = ++tokenRef.current
    pausedRef.current = false
    setIsPaused(false)
    setIsPlaying(true)

    for (let i = startIndex; i < words.length; i++) {
      if (tokenRef.current !== token) return
      const word = words[i]
      setIndex(i)
      setReveal(false)
      skipRef.current = false

      // Read + write pause, repeated N times.
      const repeats = Math.max(1, cfg.repeats)
      for (let r = 1; r <= repeats; r++) {
        if (tokenRef.current !== token) return
        if (skipRef.current) break

        setRepeatNum(r)
        setPhase('speaking')
        await speakWord(word, token)
        if (tokenRef.current !== token) return
        if (skipRef.current) break

        setPhase('writing')
        await sleepWithCountdown(cfg.interval, token)
        if (tokenRef.current !== token) return
      }

      // Reveal the answer and wait — indefinitely — for the user's self-check.
      if (tokenRef.current !== token) return
      skipRef.current = false
      resultsRef.current.push({ word, correct: null })
      setReveal(true)
      setPhase('reveal')
      setAwaitingGrade(true)
      await waitForDecision()
      setAwaitingGrade(false)
      if (tokenRef.current !== token) return

      // Checkpoint after every word so the session can be resumed later.
      if (i + 1 < words.length) {
        dispatch({
          type: 'SAVE_PROGRESS',
          mode: 'dictation',
          progress: packProgress({
            words,
            index: i + 1,
            results: resultsRef.current,
          }),
        })
      }
    }

    // Session complete.
    if (tokenRef.current === token) {
      setPhase('done')
      setIsPlaying(false)
      dispatch({ type: 'CLEAR_PROGRESS', mode: 'dictation' })
      onFinish({ mode: 'dictation', results: [...resultsRef.current] })
    }
  }

  // --- Controls ------------------------------------------------------------
  const handlePlay = () => {
    if (phase === 'idle' || phase === 'done') {
      // Continue from wherever this session was restored to (0 when new).
      run(index)
    } else if (isPaused) {
      pausedRef.current = false
      setIsPaused(false)
      if (phase === 'speaking' && ttsSupported) window.speechSynthesis.resume()
    }
  }

  const handlePause = () => {
    // Nothing to pause while we're waiting on the user's self-check.
    if (!isPlaying || isPaused || awaitingGrade) return
    pausedRef.current = true
    setIsPaused(true)
    if (phase === 'speaking' && ttsSupported) window.speechSynthesis.pause()
  }

  const handleSkip = () => {
    if (!isPlaying) return
    // Resume (if paused) and jump to the next word.
    pausedRef.current = false
    setIsPaused(false)
    skipRef.current = true
    if (ttsSupported) {
      window.speechSynthesis.resume()
      stopSpeaking()
    }
    // If we're sitting on the self-check, release it (leaving it ungraded).
    settleDecision()
  }

  const handleReplay = () => {
    if (phase === 'idle' || phase === 'done') return
    if (ttsSupported) speak(words[index].hanzi, { rate: cfg.rate, voice: voiceRef.current })
  }

  const grade = (correct) => {
    const last = resultsRef.current[resultsRef.current.length - 1]
    if (last && last.correct === null) {
      last.correct = correct
      dispatch({ type: 'GRADE_WORD', id: last.word.id, correct })
    }
    settleDecision() // release the reveal gate → advance
  }

  // Y / N answer the self-check without reaching for the mouse.
  useEffect(() => {
    if (!awaitingGrade) return
    const onKey = (e) => {
      const k = e.key.toLowerCase()
      if (k === 'y') {
        e.preventDefault()
        grade(true)
      } else if (k === 'n') {
        e.preventDefault()
        grade(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingGrade])

  const updateCfg = (changes) =>
    dispatch({ type: 'SET_DICTATION_SETTINGS', settings: changes })

  const current = words[index]
  const canStart = ttsSupported && voiceReady

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <ProgressHeader index={index} total={words.length} onExit={onExit} title="Dictation" />

      {/* TTS support / voice warnings */}
      {!ttsSupported && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <b>Text-to-speech isn’t available in this browser.</b> The characters will be shown
          during the “write” step so you can still practise. For audio, try Chrome or Edge.
        </div>
      )}
      {ttsSupported && noVoiceWarning && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          No dedicated Chinese (zh-CN) voice was found — your device may substitute a default
          voice. On desktop you can add a Chinese voice in your OS speech settings.
        </div>
      )}

      {/* Settings */}
      <div className="card space-y-4 p-4">
        <div>
          <label className="label">Write pause</label>
          <Segmented
            ariaLabel="Write pause"
            className="w-full"
            value={cfg.interval}
            disabled={isPlaying}
            onChange={(v) => updateCfg({ interval: v })}
            options={[3, 5, 8, 10, 15, 20].map((s) => ({ value: s, label: `${s}s` }))}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Repeats</label>
            <Segmented
              ariaLabel="Repeats"
              className="w-full"
              value={cfg.repeats}
              disabled={isPlaying}
              onChange={(v) => updateCfg({ repeats: v })}
              options={[1, 2, 3].map((s) => ({ value: s, label: `${s}×` }))}
            />
          </div>
          <div>
            <label className="label">Speed</label>
            <Segmented
              ariaLabel="Speed"
              className="w-full"
              value={cfg.rate}
              onChange={(v) => updateCfg({ rate: v })}
              options={[
                { value: 0.6, label: 'Slow' },
                { value: 0.9, label: 'Normal' },
                { value: 1.1, label: 'Fast' },
              ]}
            />
          </div>
        </div>
        {ttsSupported && (
          <div>
            <label className="label">Voice</label>
            <div className="flex gap-2">
              <Select
                className="flex-1"
                ariaLabel="Voice"
                value={cfg.voiceURI || ''}
                onChange={(v) => updateCfg({ voiceURI: v })}
                options={[
                  { value: '', label: 'Best available (auto)' },
                  ...voices.map((v) => ({
                    value: v.voiceURI,
                    label: v.name,
                    hint: v.localService === false ? 'online' : undefined,
                  })),
                ]}
              />
              <button
                className="btn-secondary shrink-0"
                type="button"
                disabled={!voiceReady}
                onClick={() =>
                  speak('你好，这是测试。', {
                    rate: cfg.rate,
                    voice: getPreferredVoice(cfg.voiceURI),
                  })
                }
              >
                Test
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              For the most natural voice, use Chrome (its “Google 普通话” voice is online &amp; neural)
              or install a premium Chinese voice in your OS speech settings.
            </p>
          </div>
        )}
        {isPlaying && (
          <p className="text-xs text-slate-400">Pause the session to change timing.</p>
        )}
      </div>

      {/* Stage */}
      <div className="card p-6 text-center sm:p-8">
        <div className="mb-4 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <PhaseBadge phase={phase} repeatNum={repeatNum} repeats={cfg.repeats} />
        </div>

        <div className="grid min-h-[9rem] place-items-center">
          {phase === 'idle' && (
            <p className="text-slate-500">
              {index > 0 ? (
                <>
                  Resuming at word <b>{index + 1}</b> of {words.length}. Press <b>Play</b>.
                </>
              ) : (
                <>
                  Press <b>Play</b>. Listen, then write each character on paper.
                </>
              )}
            </p>
          )}

          {phase === 'speaking' && (
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <SoundWave />
              <span className="text-sm">Listening…</span>
            </div>
          )}

          {phase === 'writing' && (
            <div className="flex flex-col items-center gap-2">
              <div key={countdown} className="animate-tick text-6xl font-bold tabular-nums text-slate-800">
                {countdown}
              </div>
              <span className="text-sm text-slate-400">
                Write it now{!ttsSupported && current ? ' — ' : ''}
              </span>
              {!ttsSupported && current && (
                <ToneText hanzi={current.hanzi} pinyin={current.pinyin} className="text-4xl font-bold" />
              )}
            </div>
          )}

          {(phase === 'reveal' || phase === 'done') && current && (
            <div className="animate-pop space-y-2">
              <ToneText hanzi={current.hanzi} pinyin={current.pinyin} className="text-6xl font-bold" />
              <div className="text-lg"><TonePinyin pinyin={current.pinyin} /></div>
              <div className="text-slate-500">{current.english}</div>
            </div>
          )}
        </div>

        {/* Self-grade during reveal — the session waits here for an answer */}
        {phase === 'reveal' && (
          <div className="animate-slide-up mt-6 border-t border-slate-100 pt-5">
            <p className="mb-3 text-sm font-medium text-slate-600">
              Did you write it correctly?
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                className="btn-secondary flex-1 !border-emerald-200 !text-emerald-700 hover:!bg-emerald-50 sm:flex-none sm:px-8"
                onClick={() => grade(true)}
              >
                ✓ Yes
              </button>
              <button
                className="btn-secondary flex-1 !border-red-200 !text-red-600 hover:!bg-red-50 sm:flex-none sm:px-8"
                onClick={() => grade(false)}
              >
                ✗ No
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Take your time — nothing advances until you choose. Press{' '}
              <kbd className="rounded bg-slate-200 px-1">Y</kbd> or{' '}
              <kbd className="rounded bg-slate-200 px-1">N</kbd>.
            </p>
          </div>
        )}
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-3">
        {isPlaying && !isPaused ? (
          <button className="btn-secondary" onClick={handlePause} disabled={!isPlaying || awaitingGrade}>
            <PauseIcon /> Pause
          </button>
        ) : (
          <button className="btn-primary" onClick={handlePlay} disabled={!canStart && ttsSupported}>
            <PlayIcon /> {phase === 'idle' || phase === 'done' ? 'Play' : 'Resume'}
          </button>
        )}
        <button className="btn-secondary" onClick={handleReplay} disabled={!isPlaying || !ttsSupported}>
          <ReplayIcon /> Replay
        </button>
        <button className="btn-secondary" onClick={handleSkip} disabled={!isPlaying}>
          <SkipIcon /> Skip
        </button>
      </div>

      {ttsSupported && !voiceReady && (
        <p className="text-center text-xs text-slate-400">Loading voice…</p>
      )}
    </div>
  )
}

function PhaseBadge({ phase, repeatNum, repeats }) {
  const map = {
    idle: 'Ready',
    speaking: `Reading · ${repeatNum}/${repeats}`,
    writing: `Write it down · rep ${repeatNum}/${repeats}`,
    reveal: 'Check your answer · waiting for you',
    done: 'Finished',
  }
  return <span>{map[phase] || ''}</span>
}

// --- Little inline icons ---------------------------------------------------
function PlayIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
}
function PauseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
}
function SkipIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5v14l9-7zM17 5h2v14h-2z" /></svg>
}
function ReplayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}
function SoundWave() {
  return (
    <div className="flex h-10 items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-emerald-500/80"
          style={{
            height: '32px',
            transformOrigin: 'center',
            animation: 'soundBar 0.9s ease-in-out infinite',
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </div>
  )
}
