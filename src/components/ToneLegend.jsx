const TONES = [
  { n: 1, label: '1st · flat', example: 'mā 妈', cls: 'text-tone1' },
  { n: 2, label: '2nd · rising', example: 'má 麻', cls: 'text-tone2' },
  { n: 3, label: '3rd · dipping', example: 'mǎ 马', cls: 'text-tone3' },
  { n: 4, label: '4th · falling', example: 'mà 骂', cls: 'text-tone4' },
  { n: 5, label: 'neutral', example: 'ma 吗', cls: 'text-tone5' },
]

export function ToneLegend() {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Tone color key
      </h3>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {TONES.map((t) => (
          <div key={t.n} className="flex items-center gap-2">
            <span className={`font-hanzi text-lg font-bold ${t.cls}`}>{t.example}</span>
            <span className="text-xs text-slate-500">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
