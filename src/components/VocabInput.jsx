import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ToneText, TonePinyin } from './ToneText.jsx'
import Select from './ui/Select.jsx'

const SAMPLE = `你好\tnǐ hǎo\thello
谢谢, xiè xie, thank you
学生\txué shēng\tstudent`

// A prompt the user can hand to any AI chatbot along with a photo of their list.
const CHATBOT_PROMPT = `Here is a photo of a Chinese vocabulary list. Transcribe every word into a plain code block, one word per line, using a Tab character to separate three fields in this exact order:

Chinese(汉字)\tpinyin\tEnglish

Rules:
- Use tone-marked pinyin, lowercase (e.g. nǐ hǎo).
- Fill in any pinyin or English that is missing from the photo.
- Keep the original order. No header row, no numbering, no extra text — just the rows.`

export default function VocabInput() {
  const { state } = useApp()
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
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Assign to topic</label>
        <Select
          ariaLabel="Assign to topic"
          value={topicId}
          onChange={setTopicId}
          options={[
            { value: '', label: '— No topic —' },
            ...state.topics.map((t) => ({ value: t.id, label: t.name })),
          ]}
        />
      </div>

      {mode === 'manual' && <ManualForm topicId={topicId} />}
      {mode === 'bulk' && <BulkForm topicId={topicId} />}
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
  const [copied, setCopied] = useState(false)

  const parsed = parseBulk(text)

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CHATBOT_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy — select the prompt text and copy it manually.')
    }
  }

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
      {/* Photo → chatbot helper */}
      <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-700">Have a photo of a list?</span>
          <button className="btn-secondary shrink-0 !px-2.5 !py-1 text-xs" onClick={copyPrompt}>
            {copied ? 'Copied ✓' : 'Copy prompt'}
          </button>
        </div>
        <p className="mb-2 text-xs text-slate-400">
          No account needed — paste this prompt and your photo into any AI chatbot (ChatGPT, Gemini,
          Claude…), then paste its reply into the box below.
        </p>
        <pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 font-mono text-[11px] leading-relaxed text-slate-600 ring-1 ring-slate-200">
          {CHATBOT_PROMPT}
        </pre>
      </div>

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
