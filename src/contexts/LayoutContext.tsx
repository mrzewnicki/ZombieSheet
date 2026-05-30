import {
  createContext, useContext, useState, useLayoutEffect,
  ReactNode, DependencyList,
} from 'react'

export interface HeaderState {
  backTo?: string
  backLabel?: string
  title?: string
  actions?: ReactNode
}

interface LayoutContextValue {
  header: HeaderState
  setHeader: (h: HeaderState) => void
}

export const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HeaderState>({})
  return (
    <LayoutContext.Provider value={{ header, setHeader }}>
      {children}
    </LayoutContext.Provider>
  )
}

/**
 * Called by page components to declare what the AppLayout header should show.
 * Updates synchronously before paint to avoid a flash of stale header.
 */
export function useLayoutHeader(header: HeaderState, deps: DependencyList = []) {
  const ctx = useContext(LayoutContext)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { ctx?.setHeader(header) }, deps)
}
