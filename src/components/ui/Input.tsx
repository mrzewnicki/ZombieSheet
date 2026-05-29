import { InputHTMLAttributes, forwardRef, useRef } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, error, className = '', id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const isNumber = rest.type === 'number'
    const innerRef = useRef<HTMLInputElement>(null)
    const resolvedRef = (ref as React.RefObject<HTMLInputElement>) ?? innerRef

    function step(dir: 1 | -1) {
      const el = resolvedRef.current
      if (!el) return
      const min = rest.min !== undefined ? Number(rest.min) : -Infinity
      const max = rest.max !== undefined ? Number(rest.max) : Infinity
      const next = Math.min(max, Math.max(min, Number(el.value) + dir))
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set
      nativeInputValueSetter?.call(el, String(next))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }

    const inputEl = (
      <input
        ref={ref ?? innerRef}
        id={inputId}
        className={`
          w-full bg-surface border border-border rounded px-3 py-2 text-sm text-ink
          placeholder-ink-faint
          focus:outline-none focus:border-blood focus:ring-1 focus:ring-blood/40
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-blood' : ''}
          ${isNumber ? 'pr-8' : ''}
          ${className}
        `}
        {...rest}
      />
    )

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs text-ink-muted uppercase tracking-widest">
            {label}
          </label>
        )}
        {isNumber ? (
          <div className="relative w-full">
            {inputEl}
            <div className="absolute right-0 inset-y-0 flex flex-col border-l border-border overflow-hidden rounded-r">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => { e.preventDefault(); step(1) }}
                className="flex-1 px-1.5 flex items-center justify-center text-ink-faint hover:text-blood hover:bg-blood/10 transition-colors leading-none text-[10px]"
              >
                ▲
              </button>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => { e.preventDefault(); step(-1) }}
                className="flex-1 px-1.5 flex items-center justify-center text-ink-faint hover:text-blood hover:bg-blood/10 transition-colors border-t border-border leading-none text-[10px]"
              >
                ▼
              </button>
            </div>
          </div>
        ) : inputEl}
        {hint && <p className="text-xs text-ink-faint">{hint}</p>}
        {error && <p className="text-xs text-blood">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
