import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GearTraitCategory, GearTraitPolarity } from '@/types'
import {
  createTraitCatalogPlaceholder,
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
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { findTraitAssignments, type TraitAssignment } from '@/utils/traitAssignments'

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

type PendingRemove = {
  message: string
}

function TraitPolarityIcon({ polarity }: { polarity: GearTraitPolarity }) {
  if (polarity === 'positive') {
    return (
      <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" aria-hidden>
        <path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0" aria-hidden>
      <path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function CategoryHeader({ category }: { category: GearTraitCategory }) {
  const { t } = useTranslation()
  const label = t(`inventory.traits.category.${category}`)
  const scope = t(`traitsCatalog.categoryScope.${category}`)

  return (
    <th className="text-left px-2 py-1.5 font-heading text-[10px] text-blood-light tracking-wider uppercase min-w-[96px]">
      <span className="inline-flex items-center gap-0.5 group/cat relative cursor-help">
        {label}
        <span className="text-ink-faint/80 normal-case tracking-normal text-[9px]" aria-hidden>ⓘ</span>
        <span
          className="
            absolute left-0 top-full z-50 pt-2
            pointer-events-none group-hover/cat:pointer-events-auto
            opacity-0 group-hover/cat:opacity-100
            translate-y-1 group-hover/cat:translate-y-0
            transition-all duration-150
          "
          role="tooltip"
        >
          <span className="block w-52 px-3 py-2 rounded border border-border bg-void text-[11px] normal-case tracking-normal text-ink-muted leading-snug shadow-lg font-body font-normal">
            {scope}
          </span>
        </span>
      </span>
    </th>
  )
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
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null)
  const [checkingAssignments, setCheckingAssignments] = useState(false)

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

  function buildRemoveConfirmMessage(
    traitName: string,
    category: GearTraitCategory,
    assignments: TraitAssignment[],
  ) {
    const lines = assignments.slice(0, 5).map((assignment) =>
      t('traitsCatalog.removeConfirmItem', {
        hero: assignment.heroName,
        item: assignment.itemName,
        type: t(`traitsCatalog.itemType.${assignment.itemType}`),
      }),
    )

    const parts = [
      t('traitsCatalog.removeConfirmInUse', {
        traitName,
        category: t(`inventory.traits.category.${category}`),
        count: assignments.length,
      }),
      ...lines,
    ]

    if (assignments.length > 5) {
      parts.push(t('traitsCatalog.removeConfirmMore', { count: assignments.length - 5 }))
    }

    return parts.join('\n')
  }

  async function executeClearDescription() {
    if (!editTarget) return
    setSaving(true)
    setError('')
    try {
      await saveTraitCatalogDescription(gameId, catalog, {
        traitName: editTarget.row.displayName,
        category: editTarget.category,
        polarity: resolveRowPolarity(editTarget.row),
        description: '',
        author,
        descriptionLabel: t('traitsCatalog.fields.description'),
      })
      closeEditor()
      setPendingRemove(null)
    } catch {
      setError(t('traitsCatalog.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function beginClearDescription() {
    if (!editTarget) return
    const trait = editTarget.row.byCategory[editTarget.category]
    if (!trait) {
      closeEditor()
      return
    }

    setCheckingAssignments(true)
    setError('')
    try {
      const assignments = await findTraitAssignments(gameId, trait.id)
      if (assignments.length === 0) {
        await executeClearDescription()
        return
      }

      setPendingRemove({
        message: buildRemoveConfirmMessage(
          editTarget.row.displayName,
          editTarget.category,
          assignments,
        ),
      })
    } catch {
      setError(t('traitsCatalog.saveError'))
    } finally {
      setCheckingAssignments(false)
    }
  }

  async function handleSaveDescription() {
    if (!editTarget) return

    const existing = editTarget.row.byCategory[editTarget.category]
    if (existing && isTraitDescriptionEmpty(editDescription)) {
      await beginClearDescription()
      return
    }

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
      await createTraitCatalogPlaceholder(gameId, catalog, {
        traitName: name,
        category: 'common',
        polarity: 'positive',
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

  async function handleRemoveDescription() {
    await beginClearDescription()
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end sm:justify-between">
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
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[640px] text-xs border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="text-left px-2 py-1.5 font-heading text-[10px] text-blood-light tracking-wider uppercase w-[7.5rem]">
                  {t('traitsCatalog.columns.name')}
                </th>
                <th className="text-left px-2 py-1.5 font-heading text-[10px] text-blood-light tracking-wider uppercase w-14">
                  {t('traitsCatalog.columns.polarity')}
                </th>
                {TRAIT_TABLE_CATEGORIES.map((category) => (
                  <CategoryHeader key={category} category={category} />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const polarity = resolveRowPolarity(row)
                const polarityBusy = polaritySaving === row.nameKey

                return (
                  <tr key={row.nameKey} className="border-b border-border/60 last:border-b-0 hover:bg-surface/40">
                    <td className="px-2 py-1 font-medium text-ink align-middle">
                      {row.displayName}
                    </td>
                    <td className="px-2 py-1 align-middle">
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
                            aria-label={t(`inventory.traits.polarity.${opt}`)}
                            title={t(`inventory.traits.polarity.${opt}`)}
                            onClick={() => handlePolarityChange(row, opt)}
                            className={`flex items-center justify-center w-6 h-5 transition-colors border-r border-border last:border-r-0 disabled:opacity-50 ${
                              polarity === opt
                                ? gearTraitPolarityClasses(opt)
                                : 'bg-surface text-ink-faint hover:text-ink hover:bg-elevated'
                            }`}
                          >
                            <TraitPolarityIcon polarity={opt} />
                          </button>
                        ))}
                      </div>
                    </td>
                    {TRAIT_TABLE_CATEGORIES.map((category) => {
                      const trait = row.byCategory[category]
                      const missing = !trait || isTraitDescriptionEmpty(trait.description)
                      const preview = trait ? traitDescriptionPreview(trait.description) : ''

                      return (
                        <td key={category} className="px-1.5 py-1 align-middle">
                          <button
                            type="button"
                            onClick={() => openEditor(row, category)}
                            className={`w-full text-left rounded border px-1.5 py-1 min-h-[1.625rem] transition-colors ${
                              missing
                                ? 'border-amber-700/50 bg-amber-950/25 hover:bg-amber-950/40 text-amber-200/70'
                                : 'border-border/60 bg-void/40 hover:bg-elevated/50 text-ink-muted'
                            }`}
                            title={missing ? t('traitsCatalog.missingDescription') : preview}
                          >
                            {missing ? (
                              <span className="text-[10px] italic leading-tight">
                                {t('traitsCatalog.addDescription')}
                              </span>
                            ) : (
                              <span className="text-[10px] leading-tight line-clamp-2">
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

            <div className="flex justify-between gap-2">
              {editTarget.row.byCategory[editTarget.category] ? (
                <Button
                  variant="ghost"
                  onClick={handleRemoveDescription}
                  loading={saving || checkingAssignments}
                  className="text-blood hover:text-blood-light"
                >
                  {t('traitsCatalog.removeDescription')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closeEditor} disabled={saving}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleSaveDescription} loading={saving || checkingAssignments}>
                  {t('common.save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        message={pendingRemove?.message ?? ''}
        onConfirm={executeClearDescription}
        onCancel={() => setPendingRemove(null)}
        dangerous
        confirmLoading={saving}
      />
    </div>
  )
}
