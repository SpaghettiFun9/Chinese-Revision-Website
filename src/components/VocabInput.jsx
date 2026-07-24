import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ToneText, TonePinyin } from './ToneText.jsx'
import { prepareImage } from '../utils/image.js'
import { parseVocabImage, MODEL_OPTIONS } from '../utils/ai.js'

const SAMPLE = `你好\tnǐ hǎo\thello
谢谢, xiè xie, thank you
学生\txué shēng\tstudent`

export default function VocabInput() {
  const { state, dispatch } = useApp()
  const [mode, setMode] = useState('manual') // 'manual' | 'bulk'
  const [topicId, setTopicId] = useState('')

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">Add vocabulary</h2>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-xs">
          <button
            className={`rounded-md px-2.5 py-1 font-medium ${mode === 'manual' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            onClick={() => setMode('manual')}
          >
            Manual
          </button>
          <button
            className={`rounded-md px-2.5 py-1 font-medium ${mode === 'bulk' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            onClick={() => setMode('bulk')}
          >
            Bulk import
          </button>
          <button
            className={`rounded-md px-2.5 py-1 font-medium ${mode === 'photo' ? 'bg-white shadow-sm' : 'text-slate-500'}`}
            onClick={() => setMode('photo')}
          >
            Photo (AI)
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Assign to topic</label>
        <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          <option value="">— No topic —</option>
          {state.topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {mode === 'manual' && <ManualForm topicId={topicId} />}
      {mode === 'bulk' && <BulkForm topicId={topicId} />}
      {mode === 'photo' && <PhotoForm topicId={topicId} />}
    </div>
  )
}

function ManualForm({ topicId }) {
  const { dispatch } = useApp()
  const [hanzi, setHanzi] = useState('')
  const [pinyin, setPinyin] = useState('')
  const [english, setEnglish] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!hanzi.trim() || !english.trim()) return
    dispatch({ type: 'ADD_WORD', word: { hanzi, pinyin, english, topicId } })
    setHanzi('')
    setPinyin('')
    setEnglish('')
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Chinese</label>
          <input className="input font-hanzi text-lg" placeholder="你好" value={hanzi} onChange={(e) => setHanzi(e.target.value)} />
        </div>
        <div>
          <label className="label">Pinyin</label>
          <input className="input" placeholder="nǐ hǎo" value={pinyin} onChange={(e) => setPinyin(e.target.value)} />
        </div>
        <div>
          <label className="label">English</label>
          <input className="input" placeholder="hello" value={english} onChange={(e) => setEnglish(e.target.value)} />
        </div>
      </div>
      {hanzi && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-400">Preview: </span>
          <ToneText hanzi={hanzi} pinyin={pinyin} className="text-lg" />
          {pinyin && <> · <TonePinyin pinyin={pinyin} /></>}
        </div>
      )}
      <button type="submit" className="btn-primary w-full">
        Add word
      </button>
    </form>
  )
}

function BulkForm({ topicId }) {
  const { dispatch } = useApp()
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const parsed = parseBulk(text)

  const submit = () => {
    if (!parsed.length) {
      setError('Nothing to import — check the format.')
      return
    }
    dispatch({ type: 'ADD_WORDS_BULK', words: parsed, topicId })
    setText('')
    setError('')
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Paste rows (tab or comma separated)</label>
        <textarea
          className="input h-32 resize-y font-mono text-xs leading-relaxed"
          placeholder={`hanzi , pinyin , english\n${SAMPLE}`}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError('')
          }}
        />
        <p className="mt-1 text-xs text-slate-400">
          One word per line: <code>Chinese</code>, <code>Pinyin</code>, <code>English</code>.
          Pinyin is optional (2 columns also works).
        </p>
      </div>

      {text.trim() && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-500">
            {parsed.length} valid row{parsed.length === 1 ? '' : 's'} detected
          </p>
          <ul className="max-h-32 space-y-1 overflow-auto text-sm">
            {parsed.slice(0, 8).map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                <ToneText hanzi={r.hanzi} pinyin={r.pinyin} className="font-hanzi" />
                <span className="text-slate-400">→ {r.english}</span>
              </li>
            ))}
            {parsed.length > 8 && <li className="text-xs text-slate-400">…and {parsed.length - 8} more</li>}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={submit} disabled={!parsed.length}>
          Import {parsed.length || ''} word{parsed.length === 1 ? '' : 's'}
        </button>
        <button className="btn-secondary" onClick={() => setText(SAMPLE)}>
          Load example
        </button>
      </div>
    </div>
  )
}

function PhotoForm({ topicId }) {
  const { state, dispatch } = useApp()
  const ai = state.settings.ai
  const [image, setImage] = useState('') // downscaled data URL
  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'done' | 'error'
  const [error, setError] = useState('')
  const [rows, setRows] = useState([]) // editable parsed rows

  const onPick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setRows([])
    setStatus('idle')
    try {
      const dataUrl = await prepareImage(file)
      setImage(dataUrl)
    } catch (err) {
      setError(err.message || 'Could not load that image.')
      setStatus('error')
    }
    e.target.value = '' // allow re-picking the same file
  }

  const analyze = async () => {
    if (!image) return
    setStatus('loading')
    setError('')
    try {
      const words = await parseVocabImage({
        apiKey: ai.apiKey,
        model: ai.model,
        imageDataUrl: image,
      })
      if (!words.length) {
        setError('No vocabulary was found in that image. Try a clearer photo.')
        setStatus('error')
        return
      }
      setRows(words)
      setStatus('done')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setStatus('error')
    }
  }

  const updateRow = (i, field, value) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i))

  const importAll = () => {
    const valid = rows.filter((r) => r.hanzi.trim() && r.english.trim())
    if (!valid.length) return
    dispatch({ type: 'ADD_WORDS_BULK', words: valid, topicId })
    setRows([])
    setImage('')
    setStatus('idle')
  }

  return (
    <div className="space-y-4">
      <ApiKeyPanel />

      <div>
        <label className="label">Photo of a vocabulary list</label>
        <label className="btn-secondary w-full cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={onPick} />
          {image ? 'Choose a different photo' : 'Upload or take a photo'}
        </label>
        <p className="mt-1 text-xs text-slate-400">
          On a phone this opens your camera or photo library. Any layout works — the AI reads
          Chinese, pinyin, and/or English and fills in whatever is missing. For best results:
          clear, well-lit, one word per line.
        </p>
      </div>

      {image && (
        <div className="overflow-hidden rounded-lg ring-1 ring-slate-200">
          <img src={image} alt="Vocabulary list preview" className="max-h-56 w-full object-contain bg-slate-50" />
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <button
          className="btn-primary w-full"
          onClick={analyze}
          disabled={!image || status === 'loading' || !ai.apiKey}
        >
          {status === 'loading' ? (
            <>
              <Spinner /> Reading the list…
            </>
          ) : (
            'Analyze with AI'
          )}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} — review &amp; edit before importing
            </p>
            <button className="text-xs text-slate-500 underline" onClick={analyze}>
              Re-scan
            </button>
          </div>
          <ul className="max-h-72 space-y-2 overflow-auto">
            {rows.map((r, i) => (
              <li key={i} className="rounded-lg bg-slate-50 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <ToneText hanzi={r.hanzi} pinyin={r.pinyin} className="text-lg" />
                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={() => removeRow(i)}
                  >
                    remove
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input className="input font-hanzi" value={r.hanzi} onChange={(e) => updateRow(i, 'hanzi', e.target.value)} />
                  <input className="input" value={r.pinyin} onChange={(e) => updateRow(i, 'pinyin', e.target.value)} />
                  <input className="input" value={r.english} onChange={(e) => updateRow(i, 'english', e.target.value)} />
                </div>
              </li>
            ))}
          </ul>
          <button className="btn-primary w-full" onClick={importAll}>
            Import {rows.length} word{rows.length === 1 ? '' : 's'}
          </button>
        </div>
      )}
    </div>
  )
}

function ApiKeyPanel() {
  const { state, dispatch } = useApp()
  const ai = state.settings.ai
  const [open, setOpen] = useState(!ai.apiKey)

  const set = (changes) => dispatch({ type: 'SET_AI_SETTINGS', settings: changes })

  return (
    <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold text-slate-700">
          Anthropic API key{' '}
          {ai.apiKey ? (
            <span className="text-emerald-600">· set ✓</span>
          ) : (
            <span className="text-red-500">· required</span>
          )}
        </span>
        <span className="text-xs text-slate-400">{open ? 'hide' : 'edit'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="label">API key</label>
            <input
              className="input font-mono text-xs"
              type="password"
              placeholder="sk-ant-…"
              value={ai.apiKey}
              onChange={(e) => set({ apiKey: e.target.value.trim() })}
              autoComplete="off"
              spellCheck="false"
            />
            <p className="mt-1 text-xs text-slate-400">
              Used only to call Anthropic directly from your browser and stored locally on this
              device (LocalStorage). Get one at{' '}
              <a
                className="underline"
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
              >
                console.anthropic.com
              </a>
              . Clear it anytime below.
            </p>
          </div>
          <div>
            <label className="label">Model</label>
            <select className="input" value={ai.model} onChange={(e) => set({ model: e.target.value })}>
              {MODEL_OPTIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {ai.apiKey && (
            <button
              className="text-xs text-red-600 hover:underline"
              onClick={() => set({ apiKey: '' })}
            >
              Clear API key from this device
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  )
}

// Parse tab/comma separated bulk text into word rows.
function parseBulk(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Prefer tabs; fall back to commas.
      const parts = (line.includes('\t') ? line.split('\t') : line.split(','))
        .map((p) => p.trim())
      if (parts.length >= 3) {
        return { hanzi: parts[0], pinyin: parts[1], english: parts.slice(2).join(', ') }
      }
      if (parts.length === 2) {
        return { hanzi: parts[0], pinyin: '', english: parts[1] }
      }
      return null
    })
    .filter((r) => r && r.hanzi && r.english)
}
