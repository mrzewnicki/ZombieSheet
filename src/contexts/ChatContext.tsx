import {
  createContext, useContext, useEffect, useState, useMemo, useRef, ReactNode,
} from 'react'
import {
  collection, query, orderBy, limit, where, addDoc, updateDoc,
  doc, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { memberLabel } from '@/types'
import type { ChatMessage, ContextRef } from '@/types/chat'
import type { GameMember } from '@/types'
import { FEATURES } from '@/config/features'

export interface SendMessageOptions {
  gmOnly?: boolean
  mentions?: string[]
  contextRef?: ContextRef
}

export interface ChatContextValue {
  messages: ChatMessage[]
  members: GameMember[]
  sendMessage: (content: string, opts?: SendMessageOptions) => Promise<void>
  pushContextMessage: (contextRef: ContextRef) => Promise<void>
  removeGmOnly: (messageId: string) => Promise<void>
  loading: boolean
  gameId: string
  sidebarOpen: boolean
  toggleSidebar: () => void
}

const LS_SIDEBAR = 'chat_sidebar_open'

function loadSidebarOpen(): boolean {
  try { return localStorage.getItem(LS_SIDEBAR) !== 'false' } catch { return true }
}

const NOOP: ChatContextValue = {
  messages: [],
  members: [],
  sendMessage: async () => {},
  pushContextMessage: async () => {},
  removeGmOnly: async () => {},
  loading: false,
  gameId: '',
  sidebarOpen: false,
  toggleSidebar: () => {},
}

const ChatContext = createContext<ChatContextValue>(NOOP)

interface ProviderProps {
  gameId: string
  children: ReactNode
}

export function ChatProvider({ gameId, children }: ProviderProps) {
  const { user } = useAuth()
  const [members, setMembers] = useState<GameMember[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(loadSidebarOpen)
  const isInitialMessages = useRef(true)
  const knownMessageIds = useRef<Set<string>>(new Set())

  function expandSidebar() {
    setSidebarOpen(true)
    try { localStorage.setItem(LS_SIDEBAR, 'true') } catch { /* ignore */ }
  }

  function toggleSidebar() {
    setSidebarOpen((v) => {
      const next = !v
      try { localStorage.setItem(LS_SIDEBAR, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  // Phase 1 — subscribe to members (determines role, used for @mention autocomplete)
  useEffect(() => {
    if (!gameId) return
    const unsub = onSnapshot(
      collection(db, 'games', gameId, 'members'),
      (snap) => {
        setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as GameMember)))
        setMembersLoaded(true)
      },
    )
    return unsub
  }, [gameId])

  // Derive GM status from members — boolean dep keeps messages effect stable
  const isGm = useMemo(
    () => members.find((m) => m.uid === user?.uid)?.role === 'gm',
    [members, user],
  )

  // Phase 2 — subscribe to messages once role is known
  useEffect(() => {
    if (!gameId || !membersLoaded) return

    const col = collection(db, 'games', gameId, 'messages')
    const msgQ = isGm
      ? query(col, orderBy('sentAt', 'asc'), limit(200))
      : query(col, where('gmOnly', '==', false), orderBy('sentAt', 'asc'), limit(200))

    const unsub = onSnapshot(msgQ, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)))
      setLoading(false)
    })

    return unsub
  }, [gameId, isGm, membersLoaded])

  // Reset message tracking when switching games
  useEffect(() => {
    isInitialMessages.current = true
    knownMessageIds.current = new Set()
  }, [gameId])

  // Auto-expand sidebar when a new dice roll message arrives while collapsed
  useEffect(() => {
    if (loading) return

    if (isInitialMessages.current) {
      isInitialMessages.current = false
      knownMessageIds.current = new Set(messages.map((m) => m.id))
      return
    }

    const hasNewDiceRoll = messages.some(
      (m) => !knownMessageIds.current.has(m.id) && m.contextRef?.type === 'dice_roll',
    )
    knownMessageIds.current = new Set(messages.map((m) => m.id))

    if (hasNewDiceRoll && !sidebarOpen) expandSidebar()
  }, [messages, loading, sidebarOpen])

  function resolveAuthor() {
    const member = members.find((m) => m.uid === user?.uid)
    return {
      authorId: user?.uid ?? '',
      authorDisplayName: member ? memberLabel(member) : (user?.displayName ?? user?.email ?? 'Unknown'),
      authorPhotoURL: user?.photoURL ?? '',
    }
  }

  async function sendMessage(content: string, opts: SendMessageOptions = {}) {
    if (!user || !content.trim()) return
    await addDoc(collection(db, 'games', gameId, 'messages'), {
      ...resolveAuthor(),
      content: content.trim(),
      sentAt: serverTimestamp(),
      gmOnly: opts.gmOnly ?? false,
      mentions: opts.mentions ?? [],
      ...(opts.contextRef ? { contextRef: opts.contextRef } : {}),
    })
  }

  async function pushContextMessage(contextRef: ContextRef) {
    if (!user) return
    if (contextRef.type === 'dice_roll') expandSidebar()
    await addDoc(collection(db, 'games', gameId, 'messages'), {
      ...resolveAuthor(),
      content: '',
      sentAt: serverTimestamp(),
      gmOnly: false,
      mentions: [],
      contextRef,
    })
  }

  async function removeGmOnly(messageId: string) {
    await updateDoc(doc(db, 'games', gameId, 'messages', messageId), { gmOnly: false })
  }

  return (
    <ChatContext.Provider value={{
      messages, members, sendMessage, pushContextMessage, removeGmOnly,
      loading, gameId, sidebarOpen, toggleSidebar,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext)
  return FEATURES.chat ? ctx : NOOP
}
