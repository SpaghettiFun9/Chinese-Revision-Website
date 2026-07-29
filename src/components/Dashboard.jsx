import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { buildQueue, needsReview } from '../utils/srs.js'
import TopicManager from './TopicManager.jsx'
import VocabInput from './VocabInput.jsx'
import WordList from './WordList.jsx'
import Select from './ui/Select.jsx'
import Segmented from './ui/Segmented.jsx'
import { progressLabel } from '../utils/progress.js'

export default function Dashboard({ onStartQuiz, onStartDictation, onResume }) {
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
        <StudyLauncher
          onStartQuiz={onStartQuiz}
          onStartDictation={onStartDictation}
          onResume={onResume}
        />
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

function StudyLauncher({ onStartQuiz, onStartDictation, onResume }) {
  const { state } = useApp()
  const [topicId, setTopicId] = useState('all')
  const [scope, setScope] = useState('all') // 'all' | 'mistakes'

  const topicWords = useMemo(() => {
    if (topicId === 'all') return state.words
    return state.words.filter((w) => w.topicId === topicId)
  }, [state.words, topicId])

  const mistakeWords = useMemo(() => topicWords.filter(needsReview), [topicWords])

  // Fall back to all words if the mistakes list empties (e.g. after a session).
  const effectiveScope = scope === 'mistakes' && mistakeWords.length === 0 ? 'all' : scope
  const selectedWords = effectiveScope === 'mistakes' ? mistakeWords : topicWords

  const canStart = selectedWords.length > 0

  // Paused sessions (if any) — resolved against the current word list so a
  // session whose words were all deleted simply doesn't offer a resume.
  const quizResume = useMemo(
    () => progressLabel(state.progress?.quiz, state.words),
    [state.progress, state.words],
  )
  const dictationResume = useMemo(
    () => progressLabel(state.progress?.dictation, state.words),
    [state.progress, state.words],
  )

  const launch = (mode) => {
    const queue = buildQueue(selectedWords)
    if (mode === 'quiz') onStartQuiz(queue)
    else onStartDictation(queue)
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Choose what to study</label>
          <Select
            ariaLabel="Choose what to study"
            value={topicId}
            onChange={setTopicId}
            options={[
              { value: 'all', label: `All topics`, hint: `${state.words.length} words` },
              ...state.topics.map((t) => ({
                value: t.id,
                label: t.name,
                hint: `${state.words.filter((w) => w.topicId === t.id).length} words`,
              })),
            ]}
          />
        </div>

        <div>
          <label className="label">Which words</label>
          <Segmented
            ariaLabel="Which words"
            className="w-full"
            value={effectiveScope}
            onChange={setScope}
            options={[
              { value: 'all', label: `All (${topicWords.length})` },
              {
                value: 'mistakes',
                label: `✗ My mistakes (${mistakeWords.length})`,
                disabled: mistakeWords.length === 0,
              },
            ]}
          />
        </div>

        <p className="text-sm text-slate-500">
          {!canStart ? (
            'No words here yet — add some in “Manage vocabulary”.'
          ) : effectiveScope === 'mistakes' ? (
            <>
              Practising the{' '}
              <span className="font-semibold text-red-600">{selectedWords.length}</span> word
              {selectedWords.length === 1 ? '' : 's'} you last got wrong. They clear once you get
              them right.
            </>
          ) : (
            <>
              <span className="font-semibold text-slate-700">{topicWords.length}</span> words ready
              {mistakeWords.length > 0 && (
                <>
                  {' '}·{' '}
                  <span className="font-semibold text-red-600">{mistakeWords.length}</span> to
                  review
                </>
              )}
            </>
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
          resume={quizResume}
          onResume={() => onResume('quiz')}
        />
        <ModeCard
          title="Dictation (Tīngxiě)"
          zh="听写"
          desc="Hear each word read aloud, pause to write it on paper, and have it repeated. Fully paced controls."
          accent="from-emerald-500 to-teal-500"
          disabled={!canStart}
          onClick={() => launch('dictation')}
          cta="Start dictation"
          resume={dictationResume}
          onResume={() => onResume('dictation')}
        />
      </div>
    </div>
  )
}

function ModeCard({ title, zh, desc, accent, disabled, onClick, cta, resume, onResume }) {
  return (
    <div className="card hover-bob flex flex-col overflow-hidden">
      <div className={`bg-gradient-to-r ${accent} px-5 py-4`}>
        <div className="font-hanzi text-2xl font-bold text-white">{zh}</div>
        <div className="text-sm font-semibold text-white/90">{title}</div>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4 p-5">
        <p className="text-sm text-slate-600">{desc}</p>

        {resume ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
              Paused at word {resume.done + 1} of {resume.total}
            </div>
            <button className="btn-primary w-full" onClick={onResume}>
              Resume ({resume.done}/{resume.total} done)
            </button>
            <button className="btn-secondary w-full" disabled={disabled} onClick={onClick}>
              Start over
            </button>
          </div>
        ) : (
          <button className="btn-primary w-full" disabled={disabled} onClick={onClick}>
            {cta}
          </button>
        )}
      </div>
    </div>
  )
}
