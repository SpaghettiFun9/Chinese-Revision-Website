import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ToneText, TonePinyin } from './ToneText.jsx'

export default function WordList() {
  const { state, dispatch } = useApp()
  const [filter, setFilter] = useState('all') // topicId | 'all'
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState(null)

  const topicName = (id) => state.topics.find((t) => t.id === id)?.name || 'Unassigned'

  const words = useMemo(() => {
    let list = state.words
    if (filter !== 'all') list = list.filter((w) => w.topicId === filter)
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (w) =>
          w.hanzi.toLowerCase().includes(q) ||
          w.pinyin.toLowerCase().includes(q) ||
          w.english.toLowerCase().includes(q),
      )
    }
    return list
  }, [state.words, filter, query])

  return (
    <div className="card flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">
          Word list <span className="text-slate-400">({words.length})</span>
        </h2>
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <select className="input sm:max-w-[45%]" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All topics</option>
          {state.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {words.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">No words match.</p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-auto">
          {words.map((w) =>
            editingId === w.id ? (
              <EditRow key={w.id} word={w} onDone={() => setEditingId(null)} />
            ) : (
              <li key={w.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <ToneText hanzi={w.hanzi} pinyin={w.pinyin} className="text-xl font-semibold" />
                    {w.pinyin && <TonePinyin pinyin={w.pinyin} className="text-sm" />}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-600">{w.english}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                      {topicName(w.topicId)}
                    </span>
                    {w.srs?.seen > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                        {w.srs.correct}/{w.srs.seen} correct
                      </span>
                    )}
                    {(w.srs?.weight ?? 1) > 2 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                        review
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditingId(w.id)}>
                    Edit
                  </button>
                  <button
                    className="btn-ghost !px-2 !py-1 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => dispatch({ type: 'DELETE_WORD', id: w.id })}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

function EditRow({ word, onDone }) {
  const { state, dispatch } = useApp()
  const [hanzi, setHanzi] = useState(word.hanzi)
  const [pinyin, setPinyin] = useState(word.pinyin)
  const [english, setEnglish] = useState(word.english)
  const [topicId, setTopicId] = useState(word.topicId || '')

  const save = () => {
    dispatch({
      type: 'UPDATE_WORD',
      id: word.id,
      changes: { hanzi: hanzi.trim(), pinyin: pinyin.trim(), english: english.trim(), topicId: topicId || null },
    })
    onDone()
  }

  return (
    <li className="space-y-2 py-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input font-hanzi" value={hanzi} onChange={(e) => setHanzi(e.target.value)} />
        <input className="input" value={pinyin} onChange={(e) => setPinyin(e.target.value)} />
        <input className="input" value={english} onChange={(e) => setEnglish(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          <option value="">— No topic —</option>
          {state.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="btn-primary shrink-0" onClick={save}>
          Save
        </button>
        <button className="btn-secondary shrink-0" onClick={onDone}>
          Cancel
        </button>
      </div>
    </li>
  )
}
