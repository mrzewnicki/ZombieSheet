import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage as ChatMessageType } from '@/types/chat'
import { useChatContext } from '@/contexts/ChatContext'
import { useAuth } from '@/contexts/AuthContext'
import Avatar from '@/components/ui/Avatar'
import { getDiceOutcomeClass, getDiceOutcomeKey } from '@/utils/diceRoll'

interface Props {
  message: ChatMessageType
  isGrouped: boolean
}

/** Renders message text with @mention highlights, inline images, and **bold** support. */
function renderContent(content: string): ReactNode {
  if (!content) return null
  const nodes: ReactNode[] = []

  // Split on tokens: image URLs, @mentions, **bold**
  const tokenRe = /(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|svg|webp)(?:\?\S*)?)|(@\S+)|(\*\*(.+?)\*\*)/gi
  let last = 0
  let match: RegExpExecArray | null

  while ((match = tokenRe.exec(content)) !== null) {
    if (match.index > last) {
      nodes.push(content.slice(last, match.index))
    }
    if (match[1]) {
      // Inline image / external glyph
      nodes.push(
        <img
          key={match.index}
          src={match[1]}
          alt=""
          className="inline-block h-5 w-5 object-contain align-middle mx-0.5"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />,
      )
    } else if (match[2]) {
      // @mention
      nodes.push(
        <span key={match.index} className="text-blood-light font-medium">
          {match[2]}
        </span>,
      )
    } else if (match[3]) {
      // **bold**
      nodes.push(
        <strong key={match.index} className="font-semibold text-ink">
          {match[4]}
        </strong>,
      )
    }
    last = match.index + match[0].length
  }

  if (last < content.length) nodes.push(content.slice(last))
  return <>{nodes}</>
}

function ColoredRolls({ rolls, total }: { rolls: number[]; total: number }) {
  const sorted = [...rolls].sort((a, b) => a - b)
  return (
    <span className="font-mono tabular-nums inline-flex items-center flex-wrap gap-x-0.5">
      {sorted.map((roll, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="text-ink-faint mx-0.5">+</span>}
          <span className={`font-medium ${getDiceOutcomeClass(roll)}`}>{roll}</span>
        </span>
      ))}
      <span className="text-ink-faint mx-1">=</span>
      <span className="font-bold text-ink">{total}</span>
    </span>
  )
}

function DiceCard({
  data,
  heroName,
  interactive,
}: {
  data: Record<string, unknown>
  heroName: string
  interactive?: boolean
}) {
  const { t } = useTranslation()
  const result = data.result as number
  const label = data.label as string
  const skillLabel = data.skillLabel as string | undefined
  const attributeLabel = data.attributeLabel as string | undefined
  const poolTotal = data.total as number | undefined
  const modifier = data.modifier as number | undefined
  const rolls = (data.rolls as number[] | undefined) ?? (result != null ? [result] : [])
  const diceCount = (data.diceCount as number | undefined) ?? rolls.length

  const secondaryLabel = skillLabel && skillLabel !== label
    ? skillLabel
    : attributeLabel && attributeLabel !== label
      ? attributeLabel
      : null

  const detail = secondaryLabel != null && poolTotal != null
    ? `${secondaryLabel}${modifier ? (modifier > 0 ? ` +${modifier}` : ` ${modifier}`) : ''} = ${poolTotal}`
    : diceCount > 0
      ? t('mechanics.diceCount', { count: diceCount })
      : null

  const singleDie = rolls.length === 1
  const outcomeKey = singleDie ? getDiceOutcomeKey(rolls[0]) : ''
  const outcomeClass = singleDie ? getDiceOutcomeClass(rolls[0]) : ''

  return (
    <div
      className={`mt-1 flex items-center gap-2 bg-elevated border border-border rounded px-3 py-1.5 text-xs w-fit max-w-full flex-wrap ${
        interactive ? 'cursor-context-menu' : ''
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 text-ink-muted">
        <path d="M3 0a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V3a3 3 0 0 0-3-3H3zm1 5.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-4 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-4 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm8 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
      </svg>
      <span className="text-ink-faint">
        {heroName} — {label}
        {detail && <span className="text-ink-faint/70"> ({detail})</span>}:
      </span>
      {rolls.length === 0 ? (
        <span className="font-mono text-ink-faint">—</span>
      ) : rolls.length === 1 ? (
        <>
          <span className={`font-mono font-bold ${outcomeClass}`}>{rolls[0]}</span>
          <span className={`font-mono font-medium ${outcomeClass}`}>{t(outcomeKey)}</span>
        </>
      ) : (
        <ColoredRolls rolls={rolls} total={result} />
      )}
    </div>
  )
}

function formatTime(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return ''
  return ts.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface ContextMenuItem {
  id: string
  label: string
  danger?: boolean
  onSelect: () => void
}

function MessageContextMenu({
  x,
  y,
  items,
  menuRef,
}: {
  x: number
  y: number
  items: ContextMenuItem[]
  menuRef: React.RefObject<HTMLDivElement>
}) {
  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] bg-void border border-border rounded shadow-lg py-1 min-w-[170px]"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`w-full text-left px-3 py-1.5 text-xs hover:bg-elevated transition-colors ${
            item.danger ? 'text-blood-light' : 'text-ink'
          }`}
          onClick={() => item.onSelect()}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}

export default function ChatMessageComponent({ message, isGrouped }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { members, removeGmOnly, rerollContextMessage, deleteMessage } = useChatContext()
  const isGm = members.find((m) => m.uid === user?.uid)?.role === 'gm'
  const isAuthor = Boolean(user?.uid && message.authorId === user.uid)

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuOpenedAt = useRef(0)

  useEffect(() => {
    if (!ctxMenu) return

    menuOpenedAt.current = performance.now()

    function close(e: MouseEvent) {
      if (performance.now() - menuOpenedAt.current < 50) return
      if (e.button === 2) return
      if (menuRef.current?.contains(e.target as Node)) return
      setCtxMenu(null)
    }

    function closeOnScroll() {
      setCtxMenu(null)
    }

    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', closeOnScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', closeOnScroll, true)
    }
  }, [ctxMenu])

  async function handleReroll() {
    if (!message.contextRef) return
    setCtxMenu(null)
    await rerollContextMessage(message.contextRef)
  }

  async function handleRemove() {
    setCtxMenu(null)
    await deleteMessage(message.id)
  }

  const isDiceRoll = message.contextRef?.type === 'dice_roll'
  const hasContent = message.content.trim().length > 0
  const hasContextMenu = (isAuthor || (isGm && message.gmOnly) || (isDiceRoll && (isAuthor || isGm)))

  function openContextMenu(e: React.MouseEvent) {
    const items: ContextMenuItem[] = []

    if (isDiceRoll && (isAuthor || isGm)) {
      items.push({ id: 'reroll', label: t('chat.rollAgain'), onSelect: () => void handleReroll() })
    }
    if (isAuthor) {
      items.push({ id: 'remove', label: t('chat.removeMessage'), danger: true, onSelect: () => void handleRemove() })
    }
    if (isGm && message.gmOnly) {
      items.push({
        id: 'gm',
        label: t('chat.showToEveryone'),
        onSelect: () => { removeGmOnly(message.id); setCtxMenu(null) },
      })
    }

    if (items.length === 0) return

    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, items })
  }

  return (
    <div
      className={`relative group/msg px-3 ${isGrouped ? 'pt-0.5 pb-0.5' : 'pt-2.5 pb-0.5'} ${
        message.gmOnly ? 'bg-blood/5 border-l-2 border-blood/30' : ''
      } ${hasContextMenu ? 'cursor-context-menu' : ''}`}
      onContextMenu={openContextMenu}
    >
      {/* Author header — only for the first message in a group */}
      {!isGrouped && (
        <div className="flex items-center gap-2 mb-0.5">
          <Avatar src={message.authorPhotoURL} name={message.authorDisplayName} className="w-5 h-5 shrink-0" />
          <span className="text-xs font-medium text-ink leading-none">{message.authorDisplayName}</span>
          {message.gmOnly && (
            <span className="text-[9px] font-mono px-1 py-px rounded border border-blood/40 text-blood/70 leading-none shrink-0">
              GM
            </span>
          )}
          <span className="text-[10px] text-ink-faint font-mono ml-auto leading-none">
            {formatTime(message.sentAt)}
          </span>
        </div>
      )}

      {/* Message content */}
      {hasContent && (
        <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-wrap break-words">
          {renderContent(message.content)}
        </p>
      )}

      {isDiceRoll && message.contextRef && (
        <DiceCard
          data={message.contextRef.data}
          heroName={message.contextRef.heroName}
          interactive={hasContextMenu}
        />
      )}

      {ctxMenu && (
        <MessageContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          menuRef={menuRef}
        />
      )}
    </div>
  )
}
