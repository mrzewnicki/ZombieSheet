import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react'
import { useChatContext } from '@/contexts/ChatContext'
import { memberLabel } from '@/types'
import type { GameMember } from '@/types'
import { extractMentionUids } from '@/utils/chatMentions'
import Avatar from '@/components/ui/Avatar'

export default function ChatInput() {
  const { t } = useTranslation()
  const { sendMessage, members } = useChatContext()

  const [value, setValue] = useState('')
  const [gmOnly, setGmOnly] = useState(false)
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)

  // @mention state
  const [mentionSearch, setMentionSearch] = useState<string | null>(null)
  const [mentionStart, setMentionStart] = useState(-1)
  const [mentionHighlight, setMentionHighlight] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [value])

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmoji) return
    function close(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showEmoji])

  const filteredMembers = mentionSearch !== null
    ? members.filter((m) =>
        memberLabel(m).toLowerCase().includes(mentionSearch.toLowerCase()) &&
        memberLabel(m).toLowerCase() !== mentionSearch.toLowerCase()
      )
    : []

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setValue(val)

    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const match = /@(\w*)$/.exec(before)
    if (match) {
      setMentionSearch(match[1])
      setMentionStart(match.index)
      setMentionHighlight(0)
    } else {
      setMentionSearch(null)
    }
  }

  function selectMention(member: GameMember) {
    const label = memberLabel(member)
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const before = value.slice(0, mentionStart)
    const after = value.slice(cursor)
    const next = before + '@' + label + ' ' + after
    setValue(next)
    setMentionSearch(null)
    setTimeout(() => {
      const pos = mentionStart + label.length + 2
      textareaRef.current?.setSelectionRange(pos, pos)
      textareaRef.current?.focus()
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionSearch !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionHighlight((h) => Math.min(h + 1, filteredMembers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionHighlight((h) => Math.max(h - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMention(filteredMembers[mentionHighlight])
        return
      }
      if (e.key === 'Escape') {
        setMentionSearch(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const handleSend = useCallback(async () => {
    const content = value.trim()
    if (!content || sending) return
    setSending(true)
    try {
      await sendMessage(content, {
        gmOnly,
        mentions: extractMentionUids(content, members),
      })
      setValue('')
      setGmOnly(false)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [value, gmOnly, sending, sendMessage, members])

  function handleEmojiClick(data: EmojiClickData) {
    const el = textareaRef.current
    if (!el) { setValue((v) => v + data.emoji); return }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + data.emoji + value.slice(end)
    setValue(next)
    setShowEmoji(false)
    setTimeout(() => {
      const pos = start + data.emoji.length
      el.setSelectionRange(pos, pos)
      el.focus()
    }, 0)
  }

  const isCommand = value.startsWith('/')

  return (
    <div className="relative flex flex-col gap-1">
      {/* @mention dropdown */}
      {mentionSearch !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-void border border-border rounded shadow-lg max-h-40 overflow-y-auto z-20">
          {filteredMembers.map((m, idx) => (
            <button
              key={m.uid}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                idx === mentionHighlight ? 'bg-elevated text-ink' : 'text-ink-muted hover:bg-elevated/50'
              }`}
              onMouseDown={(e) => { e.preventDefault(); selectMention(m) }}
            >
              <Avatar src={m.photoURL} name={memberLabel(m)} className="w-4 h-4 shrink-0" />
              <span>{memberLabel(m)}</span>
              {m.role === 'gm' && <span className="ml-auto text-[9px] font-mono text-blood/70">GM</span>}
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full mb-1 right-0 z-30">
          <EmojiPicker
            theme={Theme.DARK}
            onEmojiClick={handleEmojiClick}
            width={280}
            height={350}
            searchPlaceholder={t('chat.searchEmoji')}
            lazyLoadEmojis
          />
        </div>
      )}

      {/* Text area */}
      <div className={`flex items-end gap-1.5 bg-void border rounded transition-colors ${
        isCommand ? 'border-blood/50' : 'border-border focus-within:border-blood/40'
      }`}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.placeholder')}
          rows={1}
          className="flex-1 bg-transparent resize-none text-sm text-ink placeholder-ink-faint px-2.5 py-2 focus:outline-none leading-relaxed min-h-[36px] max-h-[120px]"
        />
        <button
          onClick={() => setShowEmoji((v) => !v)}
          className="shrink-0 p-1.5 text-ink-faint hover:text-ink transition-colors text-base leading-none mb-1"
          title={t('chat.emoji')}
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M4.285 9.567a.5.5 0 0 1 .683.183A3.498 3.498 0 0 0 8 11.5a3.498 3.498 0 0 0 3.032-1.75.5.5 0 1 1 .866.5A4.498 4.498 0 0 1 8 12.5a4.498 4.498 0 0 1-3.898-2.25.5.5 0 0 1 .183-.683zM7 6.5C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5zm4 0c0 .828-.448 1.5-1 1.5s-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5z"/>
          </svg>
        </button>
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setGmOnly((v) => !v)}
          className={`flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
            gmOnly
              ? 'border-blood/60 text-blood bg-blood/10 hover:bg-blood/20'
              : 'border-border text-ink-faint hover:border-blood/40 hover:text-blood/60'
          }`}
          title={t('chat.gmOnlyHint')}
          type="button"
        >
          <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a3 3 0 0 0-3 3v1H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2V4a3 3 0 0 0-3-3zm-1 3a1 1 0 0 1 2 0v1H7V4zm1 5a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1z"/>
          </svg>
          {t('chat.gmOnly')}
        </button>

        {isCommand && (
          <span className="text-[10px] font-mono text-blood/60">{t('chat.command')}</span>
        )}

        <button
          onClick={handleSend}
          disabled={!value.trim() || sending}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded bg-blood/80 hover:bg-blood text-white text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          type="button"
        >
          {sending ? '...' : t('chat.send')}
        </button>
      </div>
    </div>
  )
}
