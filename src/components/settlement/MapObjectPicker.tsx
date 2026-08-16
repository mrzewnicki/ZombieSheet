import { useTranslation } from 'react-i18next'
import {
  SETTLEMENT_MAP_OBJECTS,
  mapObjectLocalizedDescription,
  mapObjectLocalizedName,
} from '@/config/settlementMapObjects'
import { settlementMapObjectIcon } from '@/config/settlementMapObjectIcons'
import Button from '@/components/ui/Button'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (catalogKey: string) => void
}

export default function MapObjectPicker({ open, onClose, onPick }: Props) {
  const { t, i18n } = useTranslation()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md max-h-[85vh] flex flex-col rounded-t-xl sm:rounded-xl border border-border bg-surface shadow-2xl">
        <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-2">
          <h3 className="font-heading text-lg text-ink">{t('settlement.addObject')}</h3>
          <Button variant="ghost" className="text-xs" onClick={onClose}>{t('common.close')}</Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {SETTLEMENT_MAP_OBJECTS.map((def) => {
            const Icon = settlementMapObjectIcon(def.key)
            return (
              <button
                key={def.key}
                type="button"
                onClick={() => onPick(def.key)}
                className="w-full text-left rounded-lg border border-border bg-void/40 hover:bg-elevated/50 px-3 py-2.5 transition-colors flex items-start gap-3"
              >
                <span
                  className="w-9 h-9 rounded-md border border-border flex items-center justify-center shrink-0"
                  style={{ backgroundColor: def.defaultBgColor, color: def.defaultIconColor }}
                >
                  <Icon className="w-4 h-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <p className="text-sm text-ink font-medium">
                    {mapObjectLocalizedName(def, i18n.language)}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">
                    {mapObjectLocalizedDescription(def, i18n.language)}
                  </p>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
