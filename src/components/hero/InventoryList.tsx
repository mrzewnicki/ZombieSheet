import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  collection, addDoc, deleteDoc, updateDoc, doc,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { InventoryItem } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

interface Props {
  gameId: string
  heroId: string
  items: InventoryItem[]
  readOnly?: boolean
}

const EMPTY_FORM = { name: '', qty: 1, description: '' }

export default function InventoryList({ gameId, heroId, items, readOnly = false }: Props) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)

  const inventoryRef = collection(db, 'games', gameId, 'heroes', heroId, 'inventory')

  async function handleAdd() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await addDoc(inventoryRef, { ...form, qty: Number(form.qty) || 1 })
      setForm(EMPTY_FORM)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(item: InventoryItem) {
    await updateDoc(doc(inventoryRef, item.id), {
      name: item.name,
      qty: item.qty,
      description: item.description,
    })
    setEditingId(null)
  }

  async function handleDelete(item: InventoryItem) {
    await deleteDoc(doc(inventoryRef, item.id))
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && !showForm && (
        <p className="text-ink-faint text-sm py-4 text-center">{t('inventory.noItems')}</p>
      )}

      {items.map((item) =>
        editingId === item.id ? (
          <EditableRow
            key={item.id}
            item={item}
            onSave={handleUpdate}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div
            key={item.id}
            className="flex items-start gap-3 bg-surface border border-border rounded-lg px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-blood text-sm">×{item.qty}</span>
                <span className="text-ink text-sm font-medium truncate">{item.name}</span>
              </div>
              {item.description && (
                <div className="prose-hero mt-1 text-xs [&_p]:mb-0 [&_p]:leading-snug text-ink-faint">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>{item.description}</ReactMarkdown>
                </div>
              )}
            </div>
            {!readOnly && (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setEditingId(item.id)}
                  className="text-ink-faint hover:text-ink text-xs px-2 py-1 rounded hover:bg-elevated transition-colors"
                >
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="text-ink-faint hover:text-blood text-xs px-2 py-1 rounded hover:bg-elevated transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            )}
          </div>
        )
      )}

      {/* Add form */}
      {!readOnly && (
        showForm ? (
          <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  label={t('inventory.itemName')}
                  placeholder={t('inventory.itemNamePlaceholder')}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="w-20">
                <Input
                  label={t('inventory.qty')}
                  type="number"
                  min={1}
                  value={form.qty}
                  onChange={(e) => setForm((f) => ({ ...f, qty: Number(e.target.value) }))}
                />
              </div>
            </div>
            <Textarea
              label={t('inventory.description')}
              placeholder={t('inventory.descriptionPlaceholder')}
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAdd} loading={saving} disabled={!form.name.trim()}>
                {t('common.add')}
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full py-2 border border-dashed border-border rounded-lg text-ink-faint hover:text-ink hover:border-blood/50 text-sm transition-colors"
          >
            + {t('inventory.addItem')}
          </button>
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
  item: InventoryItem
  onSave: (item: InventoryItem) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(item)

  return (
    <div className="bg-surface border border-blood/30 rounded-lg p-4 space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            label={t('inventory.itemName')}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            autoFocus
          />
        </div>
        <div className="w-20">
          <Input
            label={t('inventory.qty')}
            type="number"
            min={1}
            value={draft.qty}
            onChange={(e) => setDraft((d) => ({ ...d, qty: Number(e.target.value) }))}
          />
        </div>
      </div>
      <Textarea
        label={t('inventory.description')}
        rows={2}
        value={draft.description}
        onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button onClick={() => onSave(draft)}>{t('common.save')}</Button>
      </div>
    </div>
  )
}
