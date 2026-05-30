import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useChatContext } from '@/contexts/ChatContext'
import { FEATURES } from '@/config/features'
import ChatMessageList from './ChatMessageList'
import ChatInput from './ChatInput'

const LS_LAST_READ = 'chat_last_read'

export default function ChatSidebar() {
  const { t } = useTranslation()
  const { messages, sidebarOpen, toggleSidebar } = useChatContext()

  // Track unread messages
  const lastRead: number = (() => {
    try { return Number(localStorage.getItem(LS_LAST_READ) ?? '0') } catch { return 0 }
  })()

  useEffect(() => {
    if (!sidebarOpen || messages.length === 0) return
    const latest = messages[messages.length - 1]?.sentAt?.toMillis() ?? Date.now()
    try { localStorage.setItem(LS_LAST_READ, String(latest)) } catch { /* ignore */ }
  }, [sidebarOpen, messages])

  const unread = sidebarOpen
    ? 0
    : messages.filter((m) => (m.sentAt?.toMillis() ?? 0) > lastRead).length

  return (
    <div
      className={`fixed right-0 top-14 h-[calc(100vh-3.5rem)] flex flex-col border-l border-border bg-void/70 backdrop-blur-md transition-all duration-200 z-40 ${
        sidebarOpen ? 'w-80' : 'w-10'
      }`}
    >
      {/* Header strip */}
      <div className={`flex items-center border-b border-border shrink-0 ${sidebarOpen ? 'px-3 py-2 gap-2' : 'justify-center py-3'}`}>
        <button
          onClick={toggleSidebar}
          className="shrink-0 text-ink-faint hover:text-ink transition-colors"
          title={sidebarOpen ? t('chat.collapse') : t('chat.expand')}
        >
          {sidebarOpen ? (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
            </svg>
          )}
        </button>

        {sidebarOpen && (
          <span className="text-xs font-heading text-ink-muted tracking-wide uppercase flex-1">
            {t('chat.title')}
          </span>
        )}

        {!sidebarOpen && unread > 0 && (
          <span className="absolute top-2 right-1.5 bg-blood text-white text-[9px] font-mono rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </div>

      {/* Body */}
      {sidebarOpen && (
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <ChatMessageList />
          </div>
          {FEATURES.chatInput && (
            <div className="shrink-0 border-t border-border p-2">
              <ChatInput />
            </div>
          )}
        </>
      )}
    </div>
  )
}
