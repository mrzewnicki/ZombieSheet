interface Props {
  children: React.ReactNode
  accent?: boolean
}

export default function GearStatChip({ children, accent = false }: Props) {
  return (
    <span
      className={
        accent
          ? 'inline-flex items-center shrink-0 text-xs font-mono text-blood-light tabular-nums px-1.5 py-0.5'
          : 'inline-flex items-center shrink-0 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-ink-muted tabular-nums'
      }
    >
      {children}
    </span>
  )
}
