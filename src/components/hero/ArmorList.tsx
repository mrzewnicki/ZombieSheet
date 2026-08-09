import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { ArmorItem, GearTraitDefinition } from '@/types'
import { EMPTY_GEAR_VISUAL, gearVisualPayload } from '@/utils/gearVisual'
import { nextGearSortOrder } from '@/utils/gearListOrder'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import RichTextEditor from '@/components/ui/RichTextEditor'
import GearVisualFields from '@/components/hero/GearVisualFields'
import GearListRow from '@/components/hero/GearListRow'
import GearSortableList from '@/components/hero/GearSortableList'
import GearStatChip from '@/components/hero/GearStatChip'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { persistGearListOrder } from '@/utils/persistGearListOrder'
import GearTraitsEditor from '@/components/hero/GearTraitsEditor'
import GearTraitChips from '@/components/hero/GearTraitChips'
import { pruneTraitValues, traitFieldsForCreate, traitFieldsForUpdate } from '@/utils/gearTraits'
import SaveIcon from '@/components/icons/SaveIcon'

interface Props {
  gameId: string
  heroId: string
  items: ArmorItem[]
  traitCatalog: GearTraitDefinition[]
  readOnly?: boolean
}

const EMPTY_FORM: ArmorFormData = {
  name: '', description: '', armorValue: 0, traitIds: [], inUse: false, ...EMPTY_GEAR_VISUAL,
}

type ArmorFormData = Omit<ArmorItem, 'id'>

function ArmorForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  saving = false,
  mode,
  gameId,
  heroId,
  traitCatalog,
}: {
  data: ArmorFormData
  onChange: (data: ArmorFormData) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  saving?: boolean
  mode: 'add' | 'edit'
  gameId: string
  heroId: string
  traitCatalog: GearTraitDefinition[]
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface border border-blood/25 rounded-lg p-4 space-y-4">
      <p className="text-xs font-mono uppercase tracking-widest text-blood-light/80">
        {mode === 'add' ? t('inventory.armor.addItem') : t('inventory.armor.editItem')}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="flex-1 min-w-0 space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">
            {t('inventory.data')}
          </p>

          <div className="flex flex-col gap-4 w-full max-w-xl">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1 min-w-0">
                <Input
                  label={t('inventory.itemName')}
                  placeholder={t('inventory.armor.namePlaceholder')}
                  value={data.name}
                  onChange={(e) => onChange({ ...data, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="w-24 shrink-0">
                <Input
                  label={t('inventory.armor.armorValue')}
                  type="number"
                  min={0}
                  value={data.armorValue}
                  onChange={(e) => onChange({ ...data, armorValue: Number(e.target.value) })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <input
                type="checkbox"
                checked={Boolean(data.inUse)}
                onChange={(e) => onChange({ ...data, inUse: e.target.checked })}
                className="gear-checkbox"
              />
              <span className="text-sm text-ink">{t('inventory.inUse')}</span>
            </label>

            <GearTraitsEditor
              gameId={gameId}
              heroId={heroId}
              scopeCategory="armor"
              traitIds={data.traitIds ?? []}
              traitValues={data.traitValues}
              catalog={traitCatalog}
              onChange={(traitIds, traitValues) => onChange({
                ...data,
                traitIds,
                traitValues: pruneTraitValues(traitIds, traitValues),
              })}
            />
          </div>
        </div>

        <GearVisualFields
          variant="aside"
          imageUrl={data.imageUrl}
          icon={data.icon}
          color={data.color}
          onChange={(patch) => onChange({ ...data, ...patch })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted uppercase tracking-widest">
          {t('inventory.description')}
        </span>
        <RichTextEditor
          placeholder={t('inventory.descriptionPlaceholder')}
          rows={2}
          value={data.description}
          onChange={(v) => onChange({ ...data, description: v })}
        />
      </div>

      <div className="flex gap-2 justify-end pt-1 border-t border-border">
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={onSubmit}
          loading={saving}
          disabled={!data.name.trim()}
          icon={mode === 'edit' ? <SaveIcon /> : undefined}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

export default function ArmorList({ gameId, heroId, items, traitCatalog, readOnly = false }: Props) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ArmorItem | null>(null)

  const armorRef = collection(db, 'games', gameId, 'heroes', heroId, 'armor')

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const { traitIds, traitValues, ...formRest } = form
      await addDoc(armorRef, {
        ...formRest,
        armorValue: Number(form.armorValue) || 0,
        ...traitFieldsForCreate(traitIds, traitValues),
        ...gearVisualPayload(form),
        sortOrder: nextGearSortOrder(items),
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(item: ArmorItem) {
    await updateDoc(doc(armorRef, item.id), {
      name: item.name,
      description: item.description,
      armorValue: item.armorValue,
      inUse: Boolean(item.inUse),
      ...traitFieldsForUpdate(item.traitIds, item.traitValues),
      ...gearVisualPayload(item),
    })
    setEditingId(null)
  }

  async function handleInUseChange(item: ArmorItem, inUse: boolean) {
    await updateDoc(doc(armorRef, item.id), { inUse })
  }

  async function handleDelete(item: ArmorItem) {
    await deleteDoc(doc(armorRef, item.id))
    setDeleteTarget(null)
  }

  async function handleReorder(orderedIds: string[]) {
    await persistGearListOrder(armorRef, orderedIds)
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !showForm && (
        <p className="text-ink-faint text-sm py-4 text-center">{t('inventory.armor.noItems')}</p>
      )}

      <GearSortableList
        items={items}
        readOnly={readOnly}
        editingId={editingId}
        onReorder={handleReorder}
        renderEditRow={(item) => (
          <EditableRow
            item={item}
            gameId={gameId}
            heroId={heroId}
            traitCatalog={traitCatalog}
            onSave={handleUpdate}
            onCancel={() => setEditingId(null)}
          />
        )}
        renderRow={(item, dragHandle) => (
          <GearListRow
            sortHandle={dragHandle}
            visual={item}
            name={item.name}
            description={item.description}
            readOnly={readOnly}
            inUse={Boolean(item.inUse)}
            inUseLabel={t('inventory.inUse')}
            onInUseChange={(checked) => handleInUseChange(item, checked)}
            onEdit={() => setEditingId(item.id)}
            onDelete={() => setDeleteTarget(item)}
            editLabel={t('common.edit')}
            deleteLabel={t('common.delete')}
            chips={(
              <>
                <GearStatChip>{t('inventory.list.armorChip', { value: item.armorValue })}</GearStatChip>
                <GearTraitChips
                  traitIds={item.traitIds}
                  traitValues={item.traitValues}
                  catalog={traitCatalog}
                />
              </>
            )}
          />
        )}
      />

      {!readOnly && (
        showForm ? (
          <ArmorForm
            mode="add"
            data={form}
            onChange={setForm}
            onSubmit={handleAdd}
            onCancel={() => { setShowForm(false); setForm(EMPTY_FORM) }}
            submitLabel={t('common.add')}
            saving={saving}
            gameId={gameId}
            heroId={heroId}
            traitCatalog={traitCatalog}
          />
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 w-fit px-4 py-2 border border-dashed border-border rounded-lg text-ink-faint hover:text-ink hover:border-ink text-sm transition-colors"
            >
              <span className="text-lg leading-none font-medium" aria-hidden>+</span>
              {t('inventory.armor.addItem')}
            </button>
          </div>
        )
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        message={t('inventory.deleteConfirm', { name: deleteTarget?.name })}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        dangerous
      />
    </div>
  )
}

function EditableRow({
  item,
  gameId,
  heroId,
  traitCatalog,
  onSave,
  onCancel,
}: {
  item: ArmorItem
  gameId: string
  heroId: string
  traitCatalog: GearTraitDefinition[]
  onSave: (item: ArmorItem) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(item)

  return (
    <ArmorForm
      mode="edit"
      data={draft}
      onChange={(data) => setDraft({ ...data, id: item.id })}
      onSubmit={() => onSave(draft)}
      onCancel={onCancel}
      submitLabel={t('common.save')}
      gameId={gameId}
      heroId={heroId}
      traitCatalog={traitCatalog}
    />
  )
}
