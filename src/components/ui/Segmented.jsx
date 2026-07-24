/**
 * A segmented control (pill button group) — a friendlier replacement for a
 * <select> when there are only a handful of options.
 *
 *   <Segmented value={v} onChange={setV} options={[{ value, label }]} />
 */
export default function Segmented({ value, onChange, options, ariaLabel, disabled = false, className = '' }) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 ${className}`}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled || disabled}
            onClick={() => onChange(o.value)}
            className={`min-w-[2.75rem] flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-150
              active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40
              ${active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
