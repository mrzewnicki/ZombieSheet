import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/config/firebase'
import type { Hero, HeroGalleryImage } from '@/types'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface Ctx {
  hero: Hero
  gameId: string
  heroId: string
  canEdit: boolean
}

type Mode = 'idle' | 'upload' | 'external'

function ExternalBadge({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const [faviconOk, setFaviconOk] = useState(true)

  let domain = ''
  try { domain = new URL(url).hostname } catch { /* ignore */ }
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`

  async function copy(e: React.MouseEvent) {
    e.stopPropagation()
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 pointer-events-auto opacity-0 group-hover/img:opacity-100 transition-opacity">
      {/* Favicon / planet — always visible, clicking copies the URL */}
      <button
        onClick={copy}
        title={copied ? '✓ Copied!' : `Click to copy URL\n${domain}`}
        className="w-5 h-5 flex items-center justify-center rounded bg-void/80 border border-ink-faint/30 hover:border-blood/40 transition-colors"
      >
        {copied ? (
          <span className="text-[9px] text-blood">✓</span>
        ) : faviconOk ? (
          <img src={faviconUrl} alt={domain} width={12} height={12} onError={() => setFaviconOk(false)} />
        ) : (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="text-ink-faint">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 1.5a5.5 5.5 0 0 1 4.47 8.67C11.9 9.97 10.04 9 8 9s-3.9.97-4.47 2.17A5.5 5.5 0 0 1 8 2.5zM8 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/>
          </svg>
        )}
      </button>
    </div>
  )
}

export default function ImagesTab() {
  const { gameId, heroId, canEdit } = useOutletContext<Ctx>()
  const { t } = useTranslation()

  const [images, setImages] = useState<HeroGalleryImage[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('idle')
  const [externalUrl, setExternalUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HeroGalleryImage | null>(null)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const galleryRef = collection(db, 'games', gameId, 'heroes', heroId, 'gallery')

  useEffect(() => {
    const q = query(galleryRef, orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HeroGalleryImage)))
      setLoading(false)
    })
    return unsub
  }, [gameId, heroId])

  function reset() {
    setMode('idle')
    setExternalUrl('')
    setCaption('')
    setPreview(null)
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const storageRef = ref(storage, `games/${gameId}/heroes/${heroId}/gallery/${Date.now()}_${file.name}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await addDoc(galleryRef, {
        url,
        caption: caption.trim(),
        source: 'upload',
        storagePath: storageRef.fullPath,
        createdAt: serverTimestamp(),
      })
      reset()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleExternalAdd() {
    if (!externalUrl.trim()) return
    setUploading(true)
    try {
      await addDoc(galleryRef, {
        url: externalUrl.trim(),
        caption: caption.trim(),
        source: 'external',
        createdAt: serverTimestamp(),
      })
      reset()
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(image: HeroGalleryImage) {
    setDeleteTarget(null)
    if (image.source === 'upload') {
      try {
        const storageRef = ref(storage, (image as HeroGalleryImage & { storagePath?: string }).storagePath ?? '')
        await deleteObject(storageRef)
      } catch { /* already deleted or path missing */ }
    }
    await deleteDoc(doc(galleryRef, image.id))
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="space-y-5">
      <h2 className="font-heading text-sm text-blood-light tracking-widest uppercase">
        {t('images.title')}
      </h2>

      {/* Add controls — canEdit only */}
      {canEdit && (
        <div className="space-y-3">
          {mode === 'idle' && (
            <div className="flex gap-2">
              <button
                onClick={() => { setMode('upload'); setCaption('') }}
                className="text-xs px-3 py-1.5 rounded border border-border text-ink-faint hover:text-ink hover:border-border-light transition-colors"
              >
                {t('images.uploadFile')}
              </button>
              <button
                onClick={() => { setMode('external'); setCaption('') }}
                className="text-xs px-3 py-1.5 rounded border border-border text-ink-faint hover:text-ink hover:border-border-light transition-colors"
              >
                {t('images.pasteLink')}
              </button>
            </div>
          )}

          {mode === 'upload' && (
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <input
                placeholder={t('images.captionPlaceholder')}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-blood focus:ring-1 focus:ring-blood/40"
              />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-xs px-3 py-1.5 rounded bg-blood/20 border border-blood/40 text-blood-light hover:bg-blood/30 transition-colors disabled:opacity-50"
                >
                  {uploading ? <Spinner size="sm" /> : t('images.chooseFile')}
                </button>
                <button onClick={reset} className="text-xs px-3 py-1.5 rounded border border-border text-ink-faint hover:text-ink transition-colors">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {mode === 'external' && (
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <input
                autoFocus
                placeholder={t('images.urlPlaceholder')}
                value={externalUrl}
                onChange={(e) => {
                  setExternalUrl(e.target.value)
                  setPreview(e.target.value.trim() || null)
                }}
                className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-blood focus:ring-1 focus:ring-blood/40"
              />
              {preview && (
                <img
                  src={preview}
                  alt="preview"
                  referrerPolicy="no-referrer"
                  className="max-h-40 rounded border border-border object-contain"
                  onError={() => setPreview(null)}
                />
              )}
              <input
                placeholder={t('images.captionPlaceholder')}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full bg-void border border-border rounded px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-blood focus:ring-1 focus:ring-blood/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleExternalAdd}
                  disabled={!externalUrl.trim() || uploading}
                  className="text-xs px-3 py-1.5 rounded bg-blood/20 border border-blood/40 text-blood-light hover:bg-blood/30 transition-colors disabled:opacity-50"
                >
                  {t('common.add')}
                </button>
                <button onClick={reset} className="text-xs px-3 py-1.5 rounded border border-border text-ink-faint hover:text-ink transition-colors">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gallery grid */}
      {images.length === 0 ? (
        <p className="text-ink-faint text-sm text-center py-8">{t('images.noImages')}</p>
      ) : (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 space-y-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              className={`group/img relative break-inside-avoid rounded-lg overflow-hidden bg-void border mb-3 ${
                img.source === 'external'
                  ? 'border-dashed border-ink-faint/40'
                  : 'border-border'
              }`}
            >
              <img
                src={img.url}
                alt={img.caption || ''}
                referrerPolicy="no-referrer"
                onClick={() => setLightboxIdx(idx)}
                className="w-full h-auto block cursor-zoom-in opacity-90 group-hover/img:opacity-100 transition-opacity"
              />

              {/* External source badge + copy link */}
              {img.source === 'external' && (
                <ExternalBadge url={img.url} />
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-void/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col justify-start p-2 pointer-events-none">
                {img.caption && (
                  <p className="text-xs text-ink leading-snug line-clamp-3">{img.caption}</p>
                )}
              </div>

              {/* Delete button */}
              {canEdit && (
                <button
                  onClick={() => setDeleteTarget(img)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded bg-void/80 text-ink-faint hover:text-blood hover:bg-void transition-colors opacity-0 group-hover/img:opacity-100 pointer-events-auto"
                  title={t('common.delete')}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6 2h4a1 1 0 0 0-2 0H6a1 1 0 0 0-2 0H2v1h12V2h-2a1 1 0 0 0-2 0zM3 5l1 9h8l1-9H3zm3 1h1v7H6V6zm3 0h1v7H9V6z"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox — rendered at document.body to escape any parent clipping */}
      {lightboxIdx !== null && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-8 cursor-zoom-out"
          onClick={() => setLightboxIdx(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxIdx(null)
            if (e.key === 'ArrowRight') setLightboxIdx((i) => i !== null ? (i + 1) % images.length : null)
            if (e.key === 'ArrowLeft') setLightboxIdx((i) => i !== null ? (i - 1 + images.length) % images.length : null)
          }}
          tabIndex={-1}
          ref={(el) => el?.focus()}
        >
          {/* Full-screen dark overlay */}
          <div className="absolute inset-0 bg-void/95 backdrop-blur-sm" />

          {/* Close button — viewport top-right */}
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxIdx(null) }}
            className="fixed top-5 right-5 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-blood border border-blood-dark text-ink hover:bg-blood-light transition-colors text-2xl leading-none shadow-lg"
          >
            ×
          </button>

          {/* Prev arrow */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => i !== null ? (i - 1 + images.length) % images.length : null) }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-surface/80 border border-border text-ink-faint hover:text-ink hover:border-border-light transition-colors text-xl"
            >
              ‹
            </button>
          )}

          <div
            className="relative cursor-default z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIdx]?.url}
              alt={images[lightboxIdx]?.caption || ''}
              referrerPolicy="no-referrer"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
            />
          </div>

          {/* Next arrow */}
          {images.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => i !== null ? (i + 1) % images.length : null) }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-surface/80 border border-border text-ink-faint hover:text-ink hover:border-border-light transition-colors text-xl"
            >
              ›
            </button>
          )}

          {/* Counter */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 text-xs font-mono text-ink-faint bg-void/80 px-2 py-1 rounded">
              {lightboxIdx + 1} / {images.length}
            </div>
          )}
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        message={t('images.deleteConfirm')}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        dangerous
      />
    </div>
  )
}
