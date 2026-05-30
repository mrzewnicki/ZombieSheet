import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { GearVisualFields } from '@/types'
import GearIcon from '@/components/hero/GearIcon'
import { hasGearThumbnail } from '@/utils/gearVisual'
import { hasRenderableGearIcon } from '@/utils/gearIcons'

interface Props extends GearVisualFields {
  label?: string
}

export default function GearItemVisual({ imageUrl, icon, label }: Props) {
  const { t } = useTranslation()
  const [lightbox, setLightbox] = useState(false)
  const showIcon = hasRenderableGearIcon(icon)
  const showImage = Boolean(imageUrl?.trim())

  useEffect(() => {
    if (!lightbox) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (!hasGearThumbnail({ imageUrl, icon })) return null

  return (
    <div className="flex items-center gap-2 shrink-0">
      {showIcon && (
        <span
          className="shrink-0 flex items-center justify-center text-[50px] leading-none text-ink"
          title={label || undefined}
        >
          <GearIcon value={icon} className="text-[50px]" />
        </span>
      )}

      {showImage && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setLightbox(true)
            }}
            className="shrink-0 w-10 h-10 rounded border border-border overflow-hidden bg-elevated cursor-zoom-in hover:border-blood/40 transition-colors"
            aria-label={label ? t('inventory.visual.viewImageNamed', { name: label }) : t('inventory.visual.viewImage')}
          >
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover pointer-events-none"
              onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
            />
          </button>

          {lightbox && createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center cursor-zoom-out"
              onClick={() => setLightbox(false)}
            >
              <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
              <img
                src={imageUrl}
                alt={label || ''}
                className="relative max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl cursor-default"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={() => setLightbox(false)}
                className="fixed top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-surface/80 border border-border text-ink-faint hover:text-ink hover:border-border-light transition-colors text-lg leading-none"
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  )
}
