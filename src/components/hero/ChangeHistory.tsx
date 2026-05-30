import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HeroChange } from '@/types'
import { Timestamp } from 'firebase/firestore'

interface Props {
  changes: HeroChange[]
}

function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('pl', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(ts.toDate())
}

function isUrl(v: unknown): v is string {
  if (typeof v !== 'string') return false
  try { return new URL(v).protocol.startsWith('http') } catch { return false }
}

function UrlValue({ url, strikethrough }: { url: string; strikethrough?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy(e: React.MouseEvent) {
    e.preventDefault()
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${strikethrough ? 'text-ink-faint' : 'text-ink'}`}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`underline underline-offset-2 hover:text-blood transition-colors text-xs font-mono ${strikethrough ? 'line-through' : ''}`}
        title={url}
      >
        [link]
      </a>
      <button
        onClick={copy}
        className="text-[10px] font-mono text-ink-faint hover:text-blood transition-colors"
        title="Copy URL"
      >
        {copied ? '✓' : '⧉'}
      </button>
    </span>
  )
}

function FormatValue({ value, strikethrough }: { value: unknown; strikethrough?: boolean }) {
  if (value === null || value === undefined) return <span className={strikethrough ? 'text-ink-faint line-through' : 'text-ink'}>—</span>
  if (isUrl(value)) return <UrlValue url={value} strikethrough={strikethrough} />
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value || '—' : JSON.stringify(value)
  return <span className={strikethrough ? 'text-ink-faint line-through' : 'text-ink'}>{text}</span>
}

export default function ChangeHistory({ changes }: Props) {
  const { t } = useTranslation()

  if (changes.length === 0) {
    return <p className="text-ink-faint text-sm text-center py-8">{t('history.noChanges')}</p>
  }

  return (
    <div className="space-y-px">
      {changes.map((change) => (
        <div
          key={change.id}
          className="flex items-center gap-3 px-3 py-1.5 rounded hover:bg-surface transition-colors"
        >
          <span className="text-[11px] text-blood font-mono uppercase tracking-wider w-40 shrink-0 truncate">
            {change.label}
          </span>
          <div className="flex items-center gap-1.5 text-xs flex-1">
            <FormatValue value={change.oldValue} strikethrough />
            <span className="text-ink-faint">→</span>
            <FormatValue value={change.newValue} />
          </div>
          <span className="text-[11px] text-ink-faint font-mono shrink-0">
            {formatDate(change.changedAt as Timestamp)}
          </span>
        </div>
      ))}
    </div>
  )
}
