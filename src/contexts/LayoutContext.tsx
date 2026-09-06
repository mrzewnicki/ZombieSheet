import {
  createContext, useContext, useState, useLayoutEffect, useCallback,
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
  /** DOM node in the header center — used to portal session music UI. */
  headerCenterEl: HTMLElement | null
  setHeaderCenterEl: (el: HTMLElement | null) => void
  /** When true, the main content container expands beyond the default max-w-5xl constraint. */
  fullWidth: boolean
  setFullWidth: (v: boolean) => void
}

export const LayoutContext = createContext<LayoutContextValue | null>(null)

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HeaderState>({})
  const [headerCenterEl, setHeaderCenterElState] = useState<HTMLElement | null>(null)
  const [fullWidth, setFullWidth] = useState(false)

  const setHeaderCenterEl = useCallback((el: HTMLElement | null) => {
    setHeaderCenterElState(el)
  }, [])

  return (
    <LayoutContext.Provider value={{
      header,
      setHeader,
      headerCenterEl,
      setHeaderCenterEl,
      fullWidth,
      setFullWidth,
    }}>
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
