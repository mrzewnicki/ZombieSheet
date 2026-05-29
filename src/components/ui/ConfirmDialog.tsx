import { useTranslation } from 'react-i18next'
import Button from './Button'

interface Props {
  open: boolean
  message: string
  onConfirm: () => void
  onCancel: () => void
  dangerous?: boolean
}

export default function ConfirmDialog({ open, message, onConfirm, onCancel, dangerous = false }: Props) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <p className="text-ink text-sm leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant={dangerous ? 'danger' : 'primary'} onClick={onConfirm}>
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </div>
  )
}
