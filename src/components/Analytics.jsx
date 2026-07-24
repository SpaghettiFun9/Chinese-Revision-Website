import { useEffect, useState } from 'react'
import { ToneText, TonePinyin } from './ToneText.jsx'

// Ease a number from 0 → target over `duration` ms (cubic ease-out).
function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(target == null ? null : 0)
  useEffect(() => {
    if (target == null) {
      setVal(null)
      return
    }
    let raf
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

export default function Analytics({ summary, onHome }) {
  const { mode, results } = summary
  const graded = results.filter((r) => r.correct !== null)
  const correct = graded.filter((r) => r.correct).length
  const total = graded.length
  const accuracy = total ? Math.round((correct / total) * 100) : null
  const toReview = graded.filter((r) => !r.correct)
  const ungraded = results.filter((r) => r.correct === null)
  const shownAccuracy = useCountUp(accuracy)

  const accentColor =
    accuracy === null ? 'text-slate-700'
      : accuracy >= 80 ? 'text-emerald-600'
      : accuracy >= 50 ? 'text-amber-600'
      : 'text-red-600'

  const message =
    accuracy === null ? 'Session complete — nice practice!'
      : accuracy >= 90 ? '太棒了! Outstanding work.'
      : accuracy >= 70 ? '做得好! Solid session.'
      : accuracy >= 40 ? '加油! Keep at it.'
      : '别灰心! Review these and try again.'

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-8 text-center text-white">
          <div className="text-sm font-medium uppercase tracking-wide text-white/70">
            {mode === 'quiz' ? 'Translation Quiz' : 'Dictation'} · Summary
          </div>
          {accuracy !== null ? (
            <>
              <div className="mt-2 text-6xl font-bold tabular-nums">{shownAccuracy}%</div>
              <div className="mt-1 text-white/80">
                {correct} / {total} correct
              </div>
            </>
          ) : (
            <div className="mt-3 text-3xl font-bold">{results.length} words practised</div>
          )}
          <div className="mt-3 font-hanzi text-lg">{message}</div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
          <Stat label="Practised" value={results.length} />
          <Stat label="Correct" value={total ? correct : '—'} className="text-emerald-600" />
          <Stat label="To review" value={toReview.length} className={toReview.length ? 'text-red-600' : ''} />
        </div>
      </div>

      {toReview.length > 0 && (
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-bold text-slate-900">
            Words to review <span className="text-slate-400">({toReview.length})</span>
          </h3>
          <ul className="divide-y divide-slate-100">
            {toReview.map((r, i) => (
              <li
                key={i}
                className="animate-slide-up flex items-center justify-between gap-3 py-2.5"
                style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
              >
                <div className="min-w-0">
                  <ToneText hanzi={r.word.hanzi} pinyin={r.word.pinyin} className="text-2xl font-semibold" />{' '}
                  <TonePinyin pinyin={r.word.pinyin} className="text-sm" />
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium text-slate-700">{r.word.english}</div>
                  {mode === 'quiz' && r.userAnswer && (
                    <div className="text-xs text-red-500">you wrote: “{r.userAnswer}”</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            These have been boosted in your SRS and will appear more often next time.
          </p>
        </div>
      )}

      {mode === 'dictation' && ungraded.length > 0 && (
        <p className="text-center text-xs text-slate-400">
          {ungraded.length} word{ungraded.length === 1 ? '' : 's'} were not self-graded.
        </p>
      )}

      <div className="flex gap-3">
        <button className="btn-primary flex-1" onClick={onHome}>
          Back to dashboard
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value, className = '' }) {
  return (
    <div className="px-3 py-4">
      <div className={`text-2xl font-bold tabular-nums ${className || 'text-slate-800'}`}>{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  )
}
