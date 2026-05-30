import { useEffect } from 'react'

/** Enter rolls, Escape closes — defers to SearchableSelect while its list is open. */
export function useThrowDialogKeyboard(open: boolean, onClose: () => void, onThrow: () => void) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const comboboxOpen = target.closest('[data-throw-combobox-open="true"]')

      if (e.key === 'Escape') {
        if (comboboxOpen) return
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (target.tagName === 'SELECT') return
        if (comboboxOpen) return
        e.preventDefault()
        onThrow()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose, onThrow])
}
