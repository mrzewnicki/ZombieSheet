import type { ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'

function DragHandleIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
      <circle cx="2.5" cy="2.5" r="1.25" />
      <circle cx="7.5" cy="2.5" r="1.25" />
      <circle cx="2.5" cy="7" r="1.25" />
      <circle cx="7.5" cy="7" r="1.25" />
      <circle cx="2.5" cy="11.5" r="1.25" />
      <circle cx="7.5" cy="11.5" r="1.25" />
    </svg>
  )
}

function SortableRow({
  id,
  readOnly,
  children,
}: {
  id: string
  readOnly?: boolean
  children: (dragHandle: ReactNode) => ReactNode
}) {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: readOnly })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dragHandle = readOnly ? null : (
    <button
      type="button"
      className="w-7 h-7 flex items-center justify-center text-ink-faint hover:text-ink cursor-grab active:cursor-grabbing rounded hover:bg-elevated transition-colors touch-none"
      aria-label={t('inventory.list.dragHandle')}
      title={t('inventory.list.dragHandle')}
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
    >
      <DragHandleIcon />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? 'relative z-10 opacity-60' : undefined}
    >
      {children(dragHandle)}
    </div>
  )
}

interface Props<T extends { id: string }> {
  items: T[]
  readOnly?: boolean
  editingId?: string | null
  onReorder: (orderedIds: string[]) => Promise<void>
  renderRow: (item: T, dragHandle: ReactNode) => ReactNode
  renderEditRow: (item: T) => ReactNode
}

export default function GearSortableList<T extends { id: string }>({
  items,
  readOnly = false,
  editingId = null,
  onReorder,
  renderRow,
  renderEditRow,
}: Props<T>) {
  const sortableIds = items.map((item) => item.id)
  const dndEnabled = !readOnly && !editingId && items.length > 1

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortableIds.indexOf(String(active.id))
    const newIndex = sortableIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    const nextIds = arrayMove(sortableIds, oldIndex, newIndex)
    await onReorder(nextIds)
  }

  const rows = items.map((item) => {
    if (editingId === item.id) {
      return <div key={item.id}>{renderEditRow(item)}</div>
    }

    return (
      <SortableRow key={item.id} id={item.id} readOnly={!dndEnabled}>
        {(dragHandle) => renderRow(item, dragHandle)}
      </SortableRow>
    )
  })

  if (!dndEnabled) {
    return <div className="space-y-3">{rows}</div>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">{rows}</div>
      </SortableContext>
    </DndContext>
  )
}
