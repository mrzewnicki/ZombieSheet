import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage as ChatMessageType } from '@/types/chat'
import { useChatContext } from '@/contexts/ChatContext'
import { useAuth } from '@/contexts/AuthContext'
import Avatar from '@/components/ui/Avatar'
import DiceRollCard from '@/components/chat/DiceRollCard'

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
  const canReroll = isDiceRoll && (isAuthor || isGm)
  const hasContent = message.content.trim().length > 0
  const hasContextMenu = isAuthor || (isGm && message.gmOnly) || canReroll

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
        <DiceRollCard
          data={message.contextRef.data}
          heroName={message.contextRef.heroName}
          canReroll={canReroll}
          onReroll={() => void handleReroll()}
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
