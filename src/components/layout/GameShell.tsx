import { useContext, useEffect } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { LayoutContext } from '@/contexts/LayoutContext'
import { ChatProvider } from '@/contexts/ChatContext'
import ChatSidebar from '@/components/chat/ChatSidebar'
import { FEATURES } from '@/config/features'

/**
 * Inner wrapper — must sit inside ChatProvider to read sidebar state.
 * Adds right-side padding equal to the sidebar width so content never
 * slides under the fixed panel.
 */
function GameShellInner() {
  return (
    <>
      <div className="max-w-5xl mx-auto px-4">
        <Outlet />
      </div>
      <ChatSidebar />
    </>
  )
}

/**
 * Layout route wrapper for all /game/:gameId/* routes.
 * When chat is enabled it provides ChatContext and docks the sidebar to the
 * right edge of the viewport. When disabled it is a transparent pass-through.
 */
export default function GameShell() {
  const { gameId = '' } = useParams()
  const layout = useContext(LayoutContext)

  useEffect(() => {
    if (!FEATURES.chat) return
    layout?.setFullWidth(true)
    return () => layout?.setFullWidth(false)
    // layout.setFullWidth is the stable useState setter — run once on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!FEATURES.chat) {
    return <Outlet />
  }

  return (
    <ChatProvider gameId={gameId}>
      <GameShellInner />
    </ChatProvider>
  )
}
