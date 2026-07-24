import { useState } from 'react'
import { useApp } from './context/AppContext.jsx'
import Dashboard from './components/Dashboard.jsx'
import QuizMode from './components/QuizMode.jsx'
import DictationMode from './components/DictationMode.jsx'
import Analytics from './components/Analytics.jsx'
import { ToneLegend } from './components/ToneLegend.jsx'

// View state machine: everything happens without a page reload.
//  dashboard → quiz | dictation → summary → dashboard
export default function App() {
  const { state } = useApp()
  const [view, setView] = useState('dashboard') // 'dashboard' | 'quiz' | 'dictation' | 'summary'
  const [session, setSession] = useState(null)   // { mode, words }
  const [summary, setSummary] = useState(null)    // { mode, results }

  const startQuiz = (words) => {
    setSession({ mode: 'quiz', words })
    setView('quiz')
  }
  const startDictation = (words) => {
    setSession({ mode: 'dictation', words })
    setView('dictation')
  }
  const finish = (result) => {
    setSummary(result)
    setView('summary')
  }
  const goHome = () => {
    setSession(null)
    setView('dashboard')
  }

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
            <Dashboard onStartQuiz={startQuiz} onStartDictation={startDictation} />
          )}
          {view === 'quiz' && (
            <QuizMode words={session.words} onFinish={finish} onExit={goHome} />
          )}
          {view === 'dictation' && (
            <DictationMode words={session.words} onFinish={finish} onExit={goHome} />
          )}
          {view === 'summary' && <Analytics summary={summary} onHome={goHome} />}
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
