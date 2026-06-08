import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GearTraitCategory, GearTraitPolarity } from '@/types'
import {
  groupTraitsForTable,
  isTraitDescriptionEmpty,
  resolveRowPolarity,
  saveTraitCatalogDescription,
  traitDescriptionPreview,
  TRAIT_TABLE_CATEGORIES,
  updateTraitRowPolarity,
  type TraitTableRow,
} from '@/utils/gearTraitCatalog'
import type { GearTraitDefinition } from '@/types'
import { gearTraitPolarityClasses } from '@/utils/gearTraits'
import RichTextEditor from '@/components/ui/RichTextEditor'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface Props {
  gameId: string
  catalog: GearTraitDefinition[]
  authorUid: string
  authorName: string
}

type EditTarget = {
  row: TraitTableRow
  category: GearTraitCategory
}

export default function TraitsTable({ gameId, catalog, authorUid, authorName }: Props) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [polaritySaving, setPolaritySaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [newTraitName, setNewTraitName] = useState('')
  const [creating, setCreating] = useState(false)

  const rows = useMemo(() => groupTraitsForTable(catalog), [catalog])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => row.displayName.toLowerCase().includes(q))
  }, [rows, search])

  const author = { uid: authorUid, displayName: authorName }

  function openEditor(row: TraitTableRow, category: GearTraitCategory) {
    const trait = row.byCategory[category]
    setEditTarget({ row, category })
    setEditDescription(trait?.description ?? '')
    setError('')
  }

  function closeEditor() {
    setEditTarget(null)
    setEditDescription('')
    setError('')
  }

  async function handleSaveDescription() {
    if (!editTarget) return
    setSaving(true)
    setError('')
    try {
      await saveTraitCatalogDescription(gameId, catalog, {
        traitName: editTarget.row.displayName,
        category: editTarget.category,
        polarity: resolveRowPolarity(editTarget.row),
        description: editDescription,
        author,
        descriptionLabel: t('traitsCatalog.fields.description'),
      })
      closeEditor()
    } catch {
      setError(t('traitsCatalog.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handlePolarityChange(row: TraitTableRow, polarity: GearTraitPolarity) {
    if (resolveRowPolarity(row) === polarity) return
    setPolaritySaving(row.nameKey)
    setError('')
    try {
      await updateTraitRowPolarity(
        gameId,
        row,
        polarity,
        author,
        t('traitsCatalog.fields.polarity'),
      )
    } catch {
      setError(t('traitsCatalog.saveError'))
    } finally {
      setPolaritySaving(null)
    }
  }

  async function handleCreateTrait() {
    const name = newTraitName.trim()
    if (!name) return
    setCreating(true)
    setError('')
    try {
      await saveTraitCatalogDescription(gameId, catalog, {
        traitName: name,
        category: 'common',
        polarity: 'positive',
        description: '',
        author,
        descriptionLabel: t('traitsCatalog.fields.description'),
      })
      setNewTraitName('')
    } catch {
      setError(t('traitsCatalog.saveError'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div className="flex-1 max-w-md">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('traitsCatalog.searchPlaceholder')}
            aria-label={t('traitsCatalog.searchPlaceholder')}
          />
        </div>
        <div className="flex gap-2 flex-1 max-w-md">
          <Input
            value={newTraitName}
            onChange={(e) => setNewTraitName(e.target.value)}
            placeholder={t('traitsCatalog.newTraitPlaceholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateTrait()
            }}
          />
          <Button
            onClick={handleCreateTrait}
            loading={creating}
            disabled={!newTraitName.trim()}
            className="shrink-0"
          >
            {t('traitsCatalog.addTrait')}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-blood">{error}</p>
      )}

      {filtered.length === 0 ? (
        <p className="text-ink-faint text-sm text-center py-10">
          {search.trim() ? t('traitsCatalog.noSearchResults') : t('traitsCatalog.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="text-left px-3 py-2.5 font-heading text-xs text-blood-light tracking-widest uppercase">
                  {t('traitsCatalog.columns.name')}
                </th>
                <th className="text-left px-3 py-2.5 font-heading text-xs text-blood-light tracking-widest uppercase w-36">
                  {t('traitsCatalog.columns.polarity')}
                </th>
                {TRAIT_TABLE_CATEGORIES.map((category) => (
                  <th
                    key={category}
                    className="text-left px-3 py-2.5 font-heading text-xs text-blood-light tracking-widest uppercase min-w-[140px]"
                  >
                    {t(`inventory.traits.category.${category}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const polarity = resolveRowPolarity(row)
                const polarityBusy = polaritySaving === row.nameKey

                return (
                  <tr key={row.nameKey} className="border-b border-border/60 last:border-b-0 hover:bg-surface/40">
                    <td className="px-3 py-2.5 font-medium text-ink align-top">
                      {row.displayName}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <div
                        className="inline-flex rounded border border-border overflow-hidden"
                        role="group"
                        aria-label={t('traitsCatalog.columns.polarity')}
                      >
                        {(['positive', 'negative'] as GearTraitPolarity[]).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            disabled={polarityBusy}
                            aria-pressed={polarity === opt}
                            onClick={() => handlePolarityChange(row, opt)}
                            className={`px-2 py-1 text-xs whitespace-nowrap transition-colors border-r border-border last:border-r-0 disabled:opacity-50 ${
                              polarity === opt
                                ? gearTraitPolarityClasses(opt)
                                : 'bg-surface text-ink-faint hover:text-ink hover:bg-elevated'
                            }`}
                          >
                            {t(`inventory.traits.polarity.${opt}`)}
                          </button>
                        ))}
                      </div>
                    </td>
                    {TRAIT_TABLE_CATEGORIES.map((category) => {
                      const trait = row.byCategory[category]
                      const missing = !trait || isTraitDescriptionEmpty(trait.description)
                      const preview = trait ? traitDescriptionPreview(trait.description) : ''

                      return (
                        <td key={category} className="px-3 py-2 align-top">
                          <button
                            type="button"
                            onClick={() => openEditor(row, category)}
                            className={`w-full text-left rounded border px-2.5 py-2 min-h-[2.75rem] transition-colors ${
                              missing
                                ? 'border-amber-700/50 bg-amber-950/25 hover:bg-amber-950/40 text-amber-200/70'
                                : 'border-border/60 bg-void/40 hover:bg-elevated/50 text-ink-muted'
                            }`}
                            title={missing ? t('traitsCatalog.missingDescription') : preview}
                          >
                            {missing ? (
                              <span className="text-xs italic">
                                {t('traitsCatalog.addDescription')}
                              </span>
                            ) : (
                              <span className="text-xs leading-relaxed line-clamp-3">
                                {preview}
                              </span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-void/80"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trait-edit-title"
        >
          <div className="w-full max-w-lg bg-surface border border-border rounded-lg shadow-xl p-5 space-y-4">
            <div>
              <h3 id="trait-edit-title" className="font-heading text-lg text-ink">
                {editTarget.row.displayName}
              </h3>
              <p className="text-xs text-ink-faint mt-0.5">
                {t(`inventory.traits.category.${editTarget.category}`)}
              </p>
            </div>

            <RichTextEditor
              value={editDescription}
              onChange={setEditDescription}
              placeholder={t('inventory.traits.descriptionPlaceholder')}
              rows={6}
              autoFocus
            />

            {error && <p className="text-sm text-blood">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeEditor} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveDescription} loading={saving}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
