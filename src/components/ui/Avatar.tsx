import { useState } from 'react'

interface Props {
  src?: string | null
  name?: string | null
  className?: string
}

export default function Avatar({ src, name, className = '' }: Props) {
  const [error, setError] = useState(false)

  const initials =
    (name ?? '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'

  if (src && !error) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        referrerPolicy="no-referrer"
        onError={() => setError(true)}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-surface border border-border flex items-center justify-center text-[10px] leading-none font-mono text-ink-muted ${className}`}
      title={name ?? ''}
    >
      {initials}
    </div>
  )
}
