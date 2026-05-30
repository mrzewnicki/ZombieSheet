import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatContext } from '@/contexts/ChatContext'
import type { ChatMessage } from '@/types/chat'
import ChatMessageComponent from './ChatMessage'
import Spinner from '@/components/ui/Spinner'

/** Group threshold in milliseconds (5 min) */
const GROUP_MS = 5 * 60 * 1000

interface MessageGroup {
  key: string
  messages: ChatMessage[]
}

type RenderItem =
  | { type: 'date_separator'; label: string; key: string }
  | { type: 'group'; group: MessageGroup }

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function formatDate(d: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (isSameDay(d, today)) return 'Dziś'
  if (isSameDay(d, yesterday)) return 'Wczoraj'
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

function buildRenderItems(messages: ChatMessage[]): RenderItem[] {
  const items: RenderItem[] = []
  let lastGroupDate: Date | null = null
  let currentGroup: MessageGroup | null = null

  function pushGroup() {
    if (currentGroup && currentGroup.messages.length > 0) {
      items.push({ type: 'group', group: currentGroup })
    }
  }

  for (const msg of messages) {
    const msgDate = msg.sentAt ? msg.sentAt.toDate() : new Date()

    // Date separator
    if (!lastGroupDate || !isSameDay(lastGroupDate, msgDate)) {
      pushGroup()
      currentGroup = null
      lastGroupDate = msgDate
      items.push({ type: 'date_separator', label: formatDate(msgDate), key: `sep-${msgDate.toDateString()}` })
    }

    const lastMsg = currentGroup?.messages[currentGroup.messages.length - 1]
    const lastTs = lastMsg?.sentAt ? lastMsg.sentAt.toMillis() : 0
    const currTs = msg.sentAt ? msg.sentAt.toMillis() : Date.now()
    const sameAuthor = lastMsg?.authorId === msg.authorId
    const closeInTime = currTs - lastTs < GROUP_MS

    if (sameAuthor && closeInTime && currentGroup) {
      currentGroup.messages.push(msg)
    } else {
      pushGroup()
      currentGroup = { key: msg.id, messages: [msg] }
    }
  }

  pushGroup()
  return items
}

export default function ChatMessageList() {
  const { messages, loading } = useChatContext()
  const { t } = useTranslation()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 gap-2">
        <span className="text-2xl opacity-30">💬</span>
        <p className="text-xs text-ink-faint text-center px-4">{t('chat.empty')}</p>
      </div>
    )
  }

  const items = buildRenderItems(messages)

  return (
    <div className="py-2">
      {items.map((item) => {
        if (item.type === 'date_separator') {
          return (
            <div key={item.key} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-ink-faint font-mono shrink-0">{item.label}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )
        }

        const { group } = item
        return (
          <div key={group.key}>
            {group.messages.map((msg, idx) => (
              <ChatMessageComponent
                key={msg.id}
                message={msg}
                isGrouped={idx > 0}
              />
            ))}
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
