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

const EMPTY_CATEGORY_SEARCHES = Object.fromEntries(
  TRAIT_TABLE_CATEGORIES.map((category) => [category, '']),
) as Record<GearTraitCategory, string>

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

function filterRowsByName(rows: TraitTableRow[], query: string): TraitTableRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) => row.displayName.toLowerCase().includes(q))
}

function rowsWithDescriptionInCategory(
  rows: TraitTableRow[],
  category: GearTraitCategory,
): TraitTableRow[] {
  return rows.filter((row) => {
    const trait = row.byCategory[category]
    return trait != null && !isTraitDescriptionEmpty(trait.description)
  })
}

function filterRowsForCategory(
  rows: TraitTableRow[],
  query: string,
  category: GearTraitCategory,
): TraitTableRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows

  return rows.filter((row) => {
    if (row.displayName.toLowerCase().includes(q)) return true
    const trait = row.byCategory[category]
    if (!trait) return false
    return traitDescriptionPreview(trait.description).toLowerCase().includes(q)
  })
}

function CategorySectionBar({
  category,
  search,
  onSearchChange,
}: {
  category: GearTraitCategory
  search: string
  onSearchChange: (value: string) => void
}) {
  const { t } = useTranslation()
  const label = t(`inventory.traits.category.${category}`)
  const scope = t(`traitsCatalog.categoryScope.${category}`)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2 py-2 bg-surface border-b border-border">
      <span className="inline-flex items-center gap-0.5 group/cat relative cursor-help shrink-0">
        <span className="font-heading text-[10px] text-blood-light tracking-wider uppercase">
          {label}
        </span>
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
      <div className="w-full sm:max-w-xs">
        <Input
          search
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('traitsCatalog.categorySearchPlaceholder')}
          aria-label={`${t('traitsCatalog.categorySearchPlaceholder')} — ${label}`}
          className="text-xs py-1.5"
        />
      </div>
    </div>
  )
}

function TraitCategoryTable({
  category,
  rows,
  categorySearch,
  polaritySaving,
  onPolarityChange,
  onOpenEditor,
}: {
  category: GearTraitCategory
  rows: TraitTableRow[]
  categorySearch: string
  polaritySaving: string | null
  onPolarityChange: (row: TraitTableRow, polarity: GearTraitPolarity) => void
  onOpenEditor: (row: TraitTableRow, category: GearTraitCategory) => void
}) {
  const { t } = useTranslation()

  if (rows.length === 0) {
    return (
      <p className="text-ink-faint text-xs text-center py-4 px-2">
        {categorySearch.trim()
          ? t('traitsCatalog.noCategorySearchResults')
          : t('traitsCatalog.emptyCategory')}
      </p>
    )
  }

  return (
    <table className="w-full min-w-[480px] text-xs border-collapse">
      <thead>
        <tr className="bg-void/30 border-b border-border/60">
          <th className="text-left px-2 py-1.5 font-heading text-[10px] text-blood-light tracking-wider uppercase w-[7.5rem]">
            {t('traitsCatalog.columns.name')}
          </th>
          <th className="text-left px-2 py-1.5 font-heading text-[10px] text-blood-light tracking-wider uppercase w-14">
            {t('traitsCatalog.columns.polarity')}
          </th>
          <th className="text-left px-2 py-1.5 font-heading text-[10px] text-blood-light tracking-wider uppercase">
            {t('traitsCatalog.columns.description')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const polarity = resolveRowPolarity(row)
          const polarityBusy = polaritySaving === row.nameKey
          const trait = row.byCategory[category]!
          const preview = traitDescriptionPreview(trait.description)

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
                      onClick={() => onPolarityChange(row, opt)}
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
              <td className="px-1.5 py-1 align-middle">
                <button
                  type="button"
                  onClick={() => onOpenEditor(row, category)}
                  className="w-full text-left rounded border border-border/60 bg-void/40 hover:bg-elevated/50 text-ink-muted px-1.5 py-1 min-h-[1.625rem] transition-colors"
                  title={preview}
                >
                  <span className="text-[10px] leading-tight line-clamp-2">
                    {preview}
                  </span>
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function TraitsTable({ gameId, catalog, authorUid, authorName }: Props) {
  const { t } = useTranslation()
  const [globalSearch, setGlobalSearch] = useState('')
  const [categorySearches, setCategorySearches] = useState(EMPTY_CATEGORY_SEARCHES)
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

  const definedRows = useMemo(
    () => rows.filter((row) =>
      TRAIT_TABLE_CATEGORIES.some((category) => {
        const trait = row.byCategory[category]
        return trait != null && !isTraitDescriptionEmpty(trait.description)
      }),
    ),
    [rows],
  )

  const globallyFiltered = useMemo(
    () => filterRowsByName(definedRows, globalSearch),
    [definedRows, globalSearch],
  )

  const rowsByCategory = useMemo(() => {
    const result = {} as Record<GearTraitCategory, TraitTableRow[]>
    for (const category of TRAIT_TABLE_CATEGORIES) {
      const inCategory = rowsWithDescriptionInCategory(globallyFiltered, category)
      result[category] = filterRowsForCategory(
        inCategory,
        categorySearches[category],
        category,
      )
    }
    return result
  }, [globallyFiltered, categorySearches])

  const author = { uid: authorUid, displayName: authorName }

  function setCategorySearch(category: GearTraitCategory, value: string) {
    setCategorySearches((prev) => ({ ...prev, [category]: value }))
  }

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
      openEditor(
        {
          nameKey: name.toLowerCase(),
          displayName: name,
          polarity: 'positive',
          byCategory: {},
        },
        'common',
      )
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
            search
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
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

      {definedRows.length === 0 ? (
        <p className="text-ink-faint text-sm text-center py-10">
          {t('traitsCatalog.empty')}
        </p>
      ) : globallyFiltered.length === 0 ? (
        <p className="text-ink-faint text-sm text-center py-10">
          {t('traitsCatalog.noSearchResults')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-border">
          {TRAIT_TABLE_CATEGORIES.map((category, index) => (
            <section
              key={category}
              className={index > 0 ? 'border-t border-border' : undefined}
            >
              <CategorySectionBar
                category={category}
                search={categorySearches[category]}
                onSearchChange={(value) => setCategorySearch(category, value)}
              />
              <TraitCategoryTable
                category={category}
                rows={rowsByCategory[category]}
                categorySearch={categorySearches[category]}
                polaritySaving={polaritySaving}
                onPolarityChange={handlePolarityChange}
                onOpenEditor={openEditor}
              />
            </section>
          ))}
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
