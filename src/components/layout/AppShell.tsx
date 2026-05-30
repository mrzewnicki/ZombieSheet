import { Outlet } from 'react-router-dom'
import { LayoutProvider } from '@/contexts/LayoutContext'
import AppLayout from './AppLayout'

/**
 * Persistent shell rendered once at the router level for all protected routes.
 * AppLayout (header + background texture) stays mounted during navigation so
 * the texture and logo animation never restart.
 */
export default function AppShell() {
  return (
    <LayoutProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </LayoutProvider>
  )
}
