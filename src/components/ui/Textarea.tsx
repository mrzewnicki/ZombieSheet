import { TextareaHTMLAttributes, forwardRef } from 'react'

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ label, hint, className = '', id, ...rest }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-xs text-ink-muted uppercase tracking-widest">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={4}
          className={`
            bg-surface border border-border rounded px-3 py-2 text-sm text-ink
            placeholder-ink-faint resize-y
            focus:outline-none focus:border-blood focus:ring-1 focus:ring-blood/40
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
          {...rest}
        />
        {hint && <p className="text-xs text-ink-faint">{hint}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
export default Textarea
