import { useEffect, useId, useRef, useState } from 'react'

/**
 * A styled, accessible replacement for a native <select>.
 *
 *   <Select value={v} onChange={setV} options={[{ value, label, hint? }]} />
 *
 * - Click / Enter / Space / ArrowDown to open
 * - Arrow keys to move, Enter to choose, Escape to close, type-ahead by label
 * - Closes on outside click; animated popover; checkmark on the active option
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  ariaLabel,
  className = '',
  buttonClassName = '',
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const typeahead = useRef({ str: '', t: 0 })
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const selectedIndex = options.findIndex((o) => o.value === value)

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // When opening, highlight the current selection and focus the list.
  useEffect(() => {
    if (open) {
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
      requestAnimationFrame(() => listRef.current?.focus())
    }
  }, [open, selectedIndex])

  const choose = (i) => {
    const opt = options[i]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
  }

  const onButtonKey = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      setOpen(true)
    }
  }

  const onListKey = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(options.length - 1, i + 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(0, i - 1))
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        // Type-ahead: jump to the next option starting with the typed letters.
        if (e.key.length === 1) {
          const now = Date.now()
          typeahead.current.str = now - typeahead.current.t > 700 ? e.key : typeahead.current.str + e.key
          typeahead.current.t = now
          const q = typeahead.current.str.toLowerCase()
          const idx = options.findIndex((o) => o.label.toLowerCase().startsWith(q))
          if (idx >= 0) setActiveIndex(idx)
        }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKey}
        className={`flex w-full items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left text-sm
          ring-1 ring-inset ring-slate-300 transition-shadow hover:ring-slate-400
          focus:outline-none focus:ring-2 focus:ring-slate-500 ${buttonClassName}`}
      >
        <span className={`truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKey}
          className="animate-scale-in absolute z-30 mt-1.5 max-h-64 w-full origin-top overflow-auto rounded-xl
            bg-white p-1 shadow-lg ring-1 ring-slate-200 focus:outline-none"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value
            const isActive = i === activeIndex
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm
                  transition-colors hover:bg-slate-100 ${isActive ? 'bg-slate-100' : ''}`}
              >
                <span className="min-w-0">
                  <span className={`block truncate ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                    {o.label}
                  </span>
                  {o.hint && <span className="block truncate text-xs text-slate-400">{o.hint}</span>}
                </span>
                {isSelected && (
                  <svg className="h-4 w-4 shrink-0 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
