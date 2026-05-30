import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { ArmorItem } from '@/types'
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

interface Props {
  gameId: string
  heroId: string
  items: ArmorItem[]
  readOnly?: boolean
}

const EMPTY_FORM = { name: '', description: '', armorValue: 0, ...EMPTY_GEAR_VISUAL }

type ArmorFormData = Omit<ArmorItem, 'id'>

function ArmorForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  saving = false,
  mode,
}: {
  data: ArmorFormData
  onChange: (data: ArmorFormData) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  saving?: boolean
  mode: 'add' | 'edit'
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface border border-blood/25 rounded-lg p-4 space-y-4">
      <p className="text-xs font-mono uppercase tracking-widest text-blood-light/80">
        {mode === 'add' ? t('inventory.armor.addItem') : t('inventory.armor.editItem')}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6">
        <div className="space-y-3 shrink-0 w-fit">
          <p className="text-xs font-mono uppercase tracking-widest text-ink-muted">
            {t('inventory.data')}
          </p>

          <div className="flex flex-col gap-4 w-96 max-w-full">
            <Input
              label={t('inventory.itemName')}
              placeholder={t('inventory.armor.namePlaceholder')}
              value={data.name}
              onChange={(e) => onChange({ ...data, name: e.target.value })}
              autoFocus
            />
            <div className="w-24">
              <Input
                label={t('inventory.armor.armorValue')}
                type="number"
                min={0}
                value={data.armorValue}
                onChange={(e) => onChange({ ...data, armorValue: Number(e.target.value) })}
              />
            </div>
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
        <Button onClick={onSubmit} loading={saving} disabled={!data.name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

export default function ArmorList({ gameId, heroId, items, readOnly = false }: Props) {
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
      await addDoc(armorRef, {
        ...form,
        armorValue: Number(form.armorValue) || 0,
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
      ...gearVisualPayload(item),
    })
    setEditingId(null)
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
            onEdit={() => setEditingId(item.id)}
            onDelete={() => setDeleteTarget(item)}
            editLabel={t('common.edit')}
            deleteLabel={t('common.delete')}
            chips={<GearStatChip>{t('inventory.list.armorChip', { value: item.armorValue })}</GearStatChip>}
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
          />
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => setShowForm(true)}
              className="w-fit px-4 py-2 border border-dashed border-border rounded-lg text-ink-faint hover:text-ink hover:border-blood/50 text-sm transition-colors"
            >
              + {t('inventory.armor.addItem')}
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
  onSave,
  onCancel,
}: {
  item: ArmorItem
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
    />
  )
}
