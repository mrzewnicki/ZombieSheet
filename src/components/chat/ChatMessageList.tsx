import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatContext } from '@/contexts/ChatContext'
import { buildRenderItems } from '@/utils/chatMessageList'
import ChatMessageComponent from './ChatMessage'
import Spinner from '@/components/ui/Spinner'

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
