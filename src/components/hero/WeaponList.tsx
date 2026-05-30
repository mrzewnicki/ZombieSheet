import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { WeaponItem, WeaponType } from '@/types'
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
  items: WeaponItem[]
  readOnly?: boolean
}

type WeaponFormData = Omit<WeaponItem, 'id'>

const EMPTY_FORM: WeaponFormData = {
  name: '',
  qty: 1,
  description: '',
  type: 'melee',
  damageExpression: '',
  ...EMPTY_GEAR_VISUAL,
}

function WeaponTypeToggle({
  value,
  onChange,
}: {
  value: WeaponType
  onChange: (type: WeaponType) => void
}) {
  const { t } = useTranslation()
  const options: WeaponType[] = ['melee', 'range']

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-muted uppercase tracking-widest">
        {t('inventory.weapons.typeLabel')}
      </span>
      <div
        className="inline-flex w-fit rounded border border-border overflow-hidden"
        role="group"
        aria-label={t('inventory.weapons.typeLabel')}
      >
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-2 text-sm whitespace-nowrap flex items-center justify-center transition-colors ${
              value === opt
                ? 'bg-blood/15 text-blood-light font-medium'
                : 'bg-surface text-ink-faint hover:text-ink hover:bg-elevated'
            }`}
          >
            {t(`inventory.weapons.type.${opt}`)}
          </button>
        ))}
      </div>
    </div>
  )
}

function WeaponForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  saving = false,
}: {
  data: WeaponFormData
  onChange: (data: WeaponFormData) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  saving?: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="bg-surface border border-blood/25 rounded-lg p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6">
        <div className="space-y-3 shrink-0">
          <p className="text-xs font-mono uppercase tracking-widest text-blood-light/80">
            {t('inventory.data')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-[6rem_auto_11rem] gap-x-4 gap-y-3 w-fit max-w-full sm:items-end">
            <div className="sm:col-span-3">
              <Input
                label={t('inventory.itemName')}
                placeholder={t('inventory.weapons.namePlaceholder')}
                value={data.name}
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                autoFocus
              />
            </div>

            <Input
              label={t('inventory.qty')}
              type="number"
              min={1}
              value={data.qty}
              onChange={(e) => onChange({ ...data, qty: Math.max(1, Number(e.target.value) || 1) })}
            />

            <WeaponTypeToggle
              value={data.type}
              onChange={(type) => onChange({ ...data, type })}
            />

            <Input
              label={t('inventory.weapons.damageExpression')}
              placeholder={t('inventory.weapons.damageExpressionPlaceholder')}
              value={data.damageExpression}
              onChange={(e) => onChange({ ...data, damageExpression: e.target.value })}
              className="font-mono"
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
        <span className="text-xs font-mono uppercase tracking-widest text-blood-light/80">
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

export default function WeaponList({ gameId, heroId, items, readOnly = false }: Props) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WeaponItem | null>(null)

  const weaponsRef = collection(db, 'games', gameId, 'heroes', heroId, 'weapons')

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await addDoc(weaponsRef, {
        ...form,
        qty: Number(form.qty) || 1,
        ...gearVisualPayload(form),
        sortOrder: nextGearSortOrder(items),
      })
      setForm(EMPTY_FORM)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(item: WeaponItem) {
    await updateDoc(doc(weaponsRef, item.id), {
      name: item.name,
      qty: item.qty,
      description: item.description,
      type: item.type,
      damageExpression: item.damageExpression,
      ...gearVisualPayload(item),
    })
    setEditingId(null)
  }

  async function handleDelete(item: WeaponItem) {
    await deleteDoc(doc(weaponsRef, item.id))
    setDeleteTarget(null)
  }

  async function handleReorder(orderedIds: string[]) {
    await persistGearListOrder(weaponsRef, orderedIds)
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !showForm && (
        <p className="text-ink-faint text-sm py-4 text-center">{t('inventory.weapons.noItems')}</p>
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
            chips={(
              <>
                <GearStatChip>×{item.qty}</GearStatChip>
                <GearStatChip>{t(`inventory.weapons.type.${item.type}`)}</GearStatChip>
                {item.damageExpression && (
                  <GearStatChip accent>{item.damageExpression}</GearStatChip>
                )}
              </>
            )}
          />
        )}
      />

      {!readOnly && (
        showForm ? (
          <WeaponForm
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
              className="inline-flex items-center gap-1.5 w-fit px-4 py-2 border border-dashed border-border rounded-lg text-ink-faint hover:text-ink hover:border-ink text-sm transition-colors"
            >
              <span className="text-lg leading-none font-medium" aria-hidden>+</span>
              {t('inventory.weapons.addItem')}
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
  item: WeaponItem
  onSave: (item: WeaponItem) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(item)

  return (
    <WeaponForm
      data={draft}
      onChange={(data) => setDraft({ ...data, id: item.id })}
      onSubmit={() => onSave(draft)}
      onCancel={onCancel}
      submitLabel={t('common.save')}
    />
  )
}
