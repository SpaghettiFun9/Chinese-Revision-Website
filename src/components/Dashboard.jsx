import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { buildQueue } from '../utils/srs.js'
import TopicManager from './TopicManager.jsx'
import VocabInput from './VocabInput.jsx'
import WordList from './WordList.jsx'

export default function Dashboard({ onStartQuiz, onStartDictation }) {
  const { state } = useApp()
  const [tab, setTab] = useState('study') // 'study' | 'manage'

  return (
    <div className="space-y-6">
      <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1">
        <TabButton active={tab === 'study'} onClick={() => setTab('study')}>
          Study
        </TabButton>
        <TabButton active={tab === 'manage'} onClick={() => setTab('manage')}>
          Manage vocabulary
        </TabButton>
      </div>

      {tab === 'study' ? (
        <StudyLauncher onStartQuiz={onStartQuiz} onStartDictation={onStartDictation} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <TopicManager />
            <VocabInput />
          </div>
          <WordList />
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  )
}

function StudyLauncher({ onStartQuiz, onStartDictation }) {
  const { state } = useApp()
  const [topicId, setTopicId] = useState('all')

  const selectedWords = useMemo(() => {
    if (topicId === 'all') return state.words
    return state.words.filter((w) => w.topicId === topicId)
  }, [state.words, topicId])

  const canStart = selectedWords.length > 0
  const strugglingCount = selectedWords.filter((w) => (w.srs?.weight ?? 1) > 2).length

  const launch = (mode) => {
    const queue = buildQueue(selectedWords)
    if (mode === 'quiz') onStartQuiz(queue)
    else onStartDictation(queue)
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <label className="label">Choose what to study</label>
        <select
          className="input"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
        >
          <option value="all">All topics ({state.words.length} words)</option>
          {state.topics.map((t) => {
            const count = state.words.filter((w) => w.topicId === t.id).length
            return (
              <option key={t.id} value={t.id}>
                {t.name} ({count})
              </option>
            )
          })}
        </select>
        <p className="mt-3 text-sm text-slate-500">
          {canStart ? (
            <>
              <span className="font-semibold text-slate-700">{selectedWords.length}</span> words ready
              {strugglingCount > 0 && (
                <> · <span className="font-semibold text-amber-600">{strugglingCount}</span> need review (shown more often)</>
              )}
            </>
          ) : (
            'No words here yet — add some in “Manage vocabulary”.'
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          title="Translation Quiz"
          zh="翻译测验"
          desc="See the characters, type the English. Instant feedback, pinyin hints, and struggling words resurface more often."
          accent="from-sky-500 to-indigo-500"
          disabled={!canStart}
          onClick={() => launch('quiz')}
          cta="Start quiz"
        />
        <ModeCard
          title="Dictation (Tīngxiě)"
          zh="听写"
          desc="Hear each word read aloud, pause to write it on paper, and have it repeated. Fully paced controls."
          accent="from-emerald-500 to-teal-500"
          disabled={!canStart}
          onClick={() => launch('dictation')}
          cta="Start dictation"
        />
      </div>
    </div>
  )
}

function ModeCard({ title, zh, desc, accent, disabled, onClick, cta }) {
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className={`bg-gradient-to-r ${accent} px-5 py-4`}>
        <div className="font-hanzi text-2xl font-bold text-white">{zh}</div>
        <div className="text-sm font-semibold text-white/90">{title}</div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <p className="text-sm text-slate-600">{desc}</p>
        <button className="btn-primary w-full" disabled={disabled} onClick={onClick}>
          {cta}
        </button>
      </div>
    </div>
  )
}
