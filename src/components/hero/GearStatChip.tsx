interface Props {
  children: React.ReactNode
  accent?: boolean
}

export default function GearStatChip({ children, accent = false }: Props) {
  return (
    <span
      className={
        accent
          ? 'text-xs font-mono text-blood-light tabular-nums'
          : 'text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-ink-muted tabular-nums'
      }
    >
      {children}
    </span>
  )
}
