interface Props {
  value: string
  onChange: (value: string) => void
  decreaseLabel: string
  increaseLabel: string
  className?: string
}

const btnClass =
  'shrink-0 w-7 h-7 flex items-center justify-center bg-void border border-border rounded text-ink-faint hover:text-ink hover:border-blood/50 transition-colors text-base font-mono leading-none cursor-pointer'

export default function StepperInput({
  value,
  onChange,
  decreaseLabel,
  increaseLabel,
  className = '',
}: Props) {
  function step(delta: number) {
    onChange(String((Number(value) || 0) + delta))
  }

  return (
    <div className={`inline-flex gap-1 ${className}`}>
      <button type="button" onClick={() => step(-1)} className={btnClass} aria-label={decreaseLabel}>
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-12 shrink-0 bg-void border border-border rounded px-1 py-1 text-sm text-ink font-mono text-center focus:outline-none focus:border-blood/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => step(1)} className={btnClass} aria-label={increaseLabel}>
        +
      </button>
    </div>
  )
}
