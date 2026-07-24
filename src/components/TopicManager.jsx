import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function TopicManager() {
  const { state, dispatch } = useApp()
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    dispatch({ type: 'ADD_TOPIC', name })
    setName('')
  }

  const startEdit = (t) => {
    setEditingId(t.id)
    setEditName(t.name)
  }
  const commitEdit = () => {
    dispatch({ type: 'RENAME_TOPIC', id: editingId, name: editName })
    setEditingId(null)
  }

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-bold text-slate-900">Topics</h2>

      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          className="input"
          placeholder='New topic, e.g. "HSK 3"'
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0">
          Add
        </button>
      </form>

      {state.topics.length === 0 ? (
        <p className="text-sm text-slate-500">No topics yet.</p>
      ) : (
        <ul className="space-y-2">
          {state.topics.map((t) => {
            const count = state.words.filter((w) => w.topicId === t.id).length
            return (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                {editingId === t.id ? (
                  <>
                    <input
                      className="input"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && commitEdit()}
                    />
                    <button className="btn-secondary shrink-0" onClick={commitEdit}>
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium text-slate-700">
                      {t.name}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      {count}
                    </span>
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs"
                      onClick={() => startEdit(t)}
                    >
                      Rename
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-1 text-xs text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm(`Delete topic “${t.name}”? Its words are kept but unassigned.`))
                          dispatch({ type: 'DELETE_TOPIC', id: t.id })
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
