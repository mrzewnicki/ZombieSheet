import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from '@/config/firebase'
import { useHeroField } from '@/hooks/useHeroField'
import type { Hero } from '@/types'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'

const SaveIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.414L11.586 1H2zm9 0v3H5V1h6zM4 9h8v5H4V9zm1 1v3h6v-3H5z"/>
  </svg>
)
import Spinner from '@/components/ui/Spinner'
import ImageCropModal from '@/components/ui/ImageCropModal'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

interface Ctx {
  hero: Hero
  gameId: string
  heroId: string
  canEdit: boolean
}

export default function PersonalTab() {
  const { hero, gameId, heroId, canEdit } = useOutletContext<Ctx>()
  const { t } = useTranslation()
  const { updateField } = useHeroField(gameId, heroId)

  const [editName, setEditName] = useState(false)
  const [editDesc, setEditDesc] = useState(false)
  const [name, setName] = useState(hero.name)
  const [surname, setSurname] = useState(hero.surname)
  const [nickname, setNickname] = useState(hero.nickname ?? '')
  const [description, setDescription] = useState(hero.description)
  const [uploading, setUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function saveName() {
    if (name !== hero.name)
      await updateField('name', t('hero.personal.name'), name, hero.name)
    if (surname !== hero.surname)
      await updateField('surname', t('hero.personal.surname'), surname, hero.surname)
    if (nickname !== (hero.nickname ?? ''))
      await updateField('nickname', t('hero.personal.nickname'), nickname.trim(), hero.nickname ?? '')
    setEditName(false)
  }

  async function saveDesc() {
    await updateField('description', t('hero.personal.description'), description, hero.description)
    setEditDesc(false)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setCropSrc(objectUrl)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleCropConfirm(blob: Blob) {
    setCropSrc(null)
    setUploading(true)
    try {
      const storageRef = ref(storage, `games/${gameId}/heroes/${heroId}/avatar`)
      await uploadBytes(storageRef, blob)
      const url = await getDownloadURL(storageRef)
      await updateField('imageURL', t('hero.personal.image'), url, hero.imageURL)
    } finally {
      setUploading(false)
    }
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Avatar + Personal Data side by side */}
      <div className="flex items-start gap-4">
        {/* Avatar column */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative w-24 h-24 rounded-lg border border-border overflow-hidden bg-void flex items-center justify-center group/avatar">
            {hero.imageURL ? (
              <img src={hero.imageURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-ink-faint text-3xl">☠</span>
            )}

            {canEdit && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1
                    bg-void/70 opacity-0 group-hover/avatar:opacity-100
                    transition-opacity duration-150 cursor-pointer"
                  title={hero.imageURL ? t('hero.personal.changeImage') : t('hero.personal.uploadImage')}
                >
                  {uploading
                    ? <Spinner size="sm" />
                    : <span className="text-ink text-xl">✎</span>
                  }
                </button>
              </>
            )}
          </div>

          {hero.imageURL && (
            <button
              onClick={() => setLightbox(true)}
              className="text-[10px] font-mono text-ink-faint hover:text-blood transition-colors"
            >
              {t('hero.personal.viewFull')}
            </button>
          )}
        </div>

        {/* Name & Surname — next to avatar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-ink-muted uppercase tracking-widest">{t('hero.personal.title')}</p>
            {canEdit && !editName && (
              <button
                onClick={() => { setName(hero.name); setSurname(hero.surname); setNickname(hero.nickname ?? ''); setEditName(true) }}
                className="text-xs text-ink-faint hover:text-ink"
              >
                {t('common.edit')}
              </button>
            )}
          </div>

          {editName ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <Input
                  label={t('hero.personal.name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Input
                  label={t('hero.personal.surname')}
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Input
                label={t('hero.personal.nickname')}
                placeholder={t('hero.personal.nicknamePlaceholder')}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={saveName} icon={<SaveIcon />}>{t('common.save')}</Button>
                <Button variant="ghost" onClick={() => setEditName(false)}>{t('common.cancel')}</Button>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-3">
              <p className="font-heading text-xl text-ink">
                {[hero.name, hero.surname].filter(Boolean).join(' ') || '—'}
              </p>
              {hero.nickname && (
                <p className="text-sm text-ink-muted mt-0.5 font-mono">
                  &ldquo;{hero.nickname}&rdquo;
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && hero.imageURL && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center cursor-zoom-out"
          onClick={() => setLightbox(false)}
        >
          <div className="absolute inset-0 bg-void/90 backdrop-blur-sm" />
          <img
            src={hero.imageURL}
            alt=""
            className="relative max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="fixed top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-surface/80 border border-border text-ink-faint hover:text-ink hover:border-border-light transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>,
        document.body
      )}

      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-ink-muted uppercase tracking-widest">
            {t('hero.personal.description')}
          </p>
          {canEdit && !editDesc && (
            <button
              onClick={() => { setDescription(hero.description); setEditDesc(true) }}
              className="text-xs text-ink-faint hover:text-ink"
            >
              {t('common.edit')}
            </button>
          )}
        </div>

        {editDesc ? (
          <div className="space-y-3">
            <Textarea
              placeholder={t('hero.personal.descriptionPlaceholder')}
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={saveDesc} icon={<SaveIcon />}>{t('common.save')}</Button>
              <Button variant="ghost" onClick={() => setEditDesc(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg px-4 py-3 min-h-[80px]">
            {hero.description ? (
              <div className="prose-hero">
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>{hero.description}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-ink-faint text-sm italic">—</p>
            )}
          </div>
        )}
      </div>
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  )
}
