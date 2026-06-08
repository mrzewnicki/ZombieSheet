import { useTranslation } from 'react-i18next'
import { Timestamp } from 'firebase/firestore'
import type { GearTraitChange } from '@/types'

interface Props {
  changes: GearTraitChange[]
}

function formatDate(ts: Timestamp | null | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('pl', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(ts.toDate())
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  return String(value)
}

export default function TraitChangeHistory({ changes }: Props) {
  const { t } = useTranslation()

  if (changes.length === 0) {
    return (
      <p className="text-ink-faint text-sm text-center py-6">
        {t('traitsCatalog.noChanges')}
      </p>
    )
  }

  return (
    <div className="space-y-px">
      {changes.map((change) => (
        <div
          key={change.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded hover:bg-surface transition-colors text-xs"
        >
          <span className="text-[11px] text-blood font-mono uppercase tracking-wider shrink-0">
            {change.changedByName || t('traitsCatalog.unknownUser')}
          </span>
          <span className="text-ink-muted shrink-0">
            {change.traitName}
            <span className="text-ink-faint mx-1">·</span>
            {t(`inventory.traits.category.${change.category}`)}
          </span>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-ink-faint truncate">{change.label}</span>
            <span className="text-ink-faint shrink-0">→</span>
            <span className="text-ink truncate" title={formatValue(change.newValue)}>
              {formatValue(change.newValue).slice(0, 80)}
              {formatValue(change.newValue).length > 80 ? '…' : ''}
            </span>
          </div>
          <span className="text-[11px] text-ink-faint font-mono shrink-0">
            {formatDate(change.changedAt)}
          </span>
        </div>
      ))}
    </div>
  )
}
