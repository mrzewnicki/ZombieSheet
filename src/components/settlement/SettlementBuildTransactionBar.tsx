import { useTranslation } from 'react-i18next'
import { SETTLEMENT_MATERIALS, type SettlementMaterialKey } from '@/config/settlementMaterials'
import Button from '@/components/ui/Button'
import {
  canAffordMaterialDelta,
  materialDeltaHasValues,
  type MaterialDelta,
} from '@/utils/settlementBuildTransaction'

interface Props {
  delta: MaterialDelta
  materials: Record<string, number>
  addedCount: number
  removedCount: number
  onConfirm: () => void
  onFree: () => void
}

export default function SettlementBuildTransactionBar({
  delta,
  materials,
  addedCount,
  removedCount,
  onConfirm,
  onFree,
}: Props) {
  const { t } = useTranslation()
  const hasValues = materialDeltaHasValues(delta)
  const affordable = canAffordMaterialDelta(materials, delta)
  const lines = SETTLEMENT_MATERIALS
    .map((mat) => ({ mat, amount: delta[mat.key as SettlementMaterialKey] }))
    .filter((row) => row.amount !== 0)

  return (
    <div className="rounded-lg border border-blood-light/40 bg-void/90 px-3 py-2.5 space-y-2 shadow-lg shadow-void/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[10px] font-mono uppercase tracking-wider text-blood-light">
          {t('settlement.buildTxnTitle')}
        </p>
        <p className="text-[10px] font-mono text-ink-faint">
          {t('settlement.buildTxnCounts', { added: addedCount, removed: removedCount })}
        </p>
      </div>

      {!hasValues ? (
        <p className="text-xs text-ink-muted">{t('settlement.buildTxnEmpty')}</p>
      ) : (
        <ul className="space-y-1">
          {lines.map(({ mat, amount }) => {
            const stock = materials[mat.key] ?? 0
            const short = amount > 0 && stock < amount
            return (
              <li
                key={mat.key}
                className={`flex items-center justify-between gap-3 text-xs font-mono ${
                  short ? 'text-blood-light' : amount > 0 ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                <span>{t(mat.labelKey)}</span>
                <span className="tabular-nums">
                  {amount > 0 ? `−${amount}` : `+${Math.abs(amount)}`}
                  {amount > 0 && (
                    <span className="text-ink-faint"> ({stock})</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {!affordable && hasValues && (
        <p className="text-[11px] text-blood-light">{t('settlement.buildTxnInsufficient')}</p>
      )}

      <div className="flex flex-wrap gap-2 pt-0.5">
        <Button
          variant="primary"
          className="text-xs"
          onClick={onConfirm}
          disabled={!affordable && hasValues}
        >
          {t('settlement.buildTxnConfirm')}
        </Button>
        <Button variant="outline" className="text-xs" onClick={onFree}>
          {t('settlement.buildTxnFree')}
        </Button>
      </div>
    </div>
  )
}
