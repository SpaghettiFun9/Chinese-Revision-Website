import { useState } from 'react'
import { useApp } from './context/AppContext.jsx'
import { buildQueue } from './utils/srs.js'
import { unpackProgress } from './utils/progress.js'
import Dashboard from './components/Dashboard.jsx'
import QuizMode from './components/QuizMode.jsx'
import DictationMode from './components/DictationMode.jsx'
import Analytics from './components/Analytics.jsx'
import { ToneLegend } from './components/ToneLegend.jsx'

// View state machine: everything happens without a page reload.
//  dashboard → quiz | dictation → summary → dashboard
export default function App() {
  const { state, dispatch } = useApp()
  const [view, setView] = useState('dashboard') // 'dashboard' | 'quiz' | 'dictation' | 'summary'
  const [session, setSession] = useState(null)   // { mode, words, index, results }
  const [summary, setSummary] = useState(null)    // { mode, results }

  // Starting fresh discards any paused session for that mode.
  const start = (mode, words) => {
    dispatch({ type: 'CLEAR_PROGRESS', mode })
    setSession({ mode, words, index: 0, results: [] })
    setView(mode)
  }
  const startQuiz = (words) => start('quiz', words)
  const startDictation = (words) => start('dictation', words)

  // Pick a paused session back up exactly where it stopped.
  const resume = (mode) => {
    const restored = unpackProgress(state.progress?.[mode], state.words)
    if (!restored) {
      dispatch({ type: 'CLEAR_PROGRESS', mode })
      return
    }
    setSession({ mode, ...restored })
    setView(mode)
  }

  const finish = (result) => {
    setSummary(result)
    setView('summary')
  }
  const goHome = () => {
    setSession(null)
    setView('dashboard')
  }
  // Re-run a session using only the words just missed.
  const retry = (mode, words) => start(mode, buildQueue(words))

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button onClick={goHome} className="flex items-center gap-2 text-left">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 font-hanzi text-lg text-white">
              汉
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-slate-900">Chinese Revision</span>
              <span className="block text-xs text-slate-500">复习 · vocab · quiz · tīngxiě</span>
            </span>
          </button>
          <div className="hidden text-xs text-slate-500 sm:block">
            {state.words.length} words · {state.topics.length} topics
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">
        {/* key changes per view → the wrapper remounts and animates in */}
        <div key={view} className="animate-fade-in">
          {view === 'dashboard' && (
            <Dashboard
              onStartQuiz={startQuiz}
              onStartDictation={startDictation}
              onResume={resume}
            />
          )}
          {view === 'quiz' && (
            <QuizMode
              words={session.words}
              initialIndex={session.index}
              initialResults={session.results}
              onFinish={finish}
              onExit={goHome}
            />
          )}
          {view === 'dictation' && (
            <DictationMode
              words={session.words}
              initialIndex={session.index}
              initialResults={session.results}
              onFinish={finish}
              onExit={goHome}
            />
          )}
          {view === 'summary' && (
            <Analytics summary={summary} onHome={goHome} onRetry={retry} />
          )}
        </div>
      </main>

      {view === 'dashboard' && (
        <footer className="mx-auto max-w-5xl px-4 pb-10">
          <ToneLegend />
        </footer>
      )}
    </div>
  )
}
