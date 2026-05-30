import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useThrowDialogKeyboard } from './useThrowDialogKeyboard'

describe('useThrowDialogKeyboard', () => {
  const onClose = vi.fn()
  const onThrow = vi.fn()

  afterEach(() => {
    vi.clearAllMocks()
  })

  function mountOpen() {
    return renderHook(() => useThrowDialogKeyboard(true, onClose, onThrow))
  }

  function keyDown(key: string, target?: EventTarget) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true })
    if (target) {
      Object.defineProperty(event, 'target', { value: target, configurable: true })
    }
    window.dispatchEvent(event)
  }

  it('does not listen when dialog is closed', () => {
    renderHook(() => useThrowDialogKeyboard(false, onClose, onThrow))
    keyDown('Enter')
    expect(onThrow).not.toHaveBeenCalled()
  })

  it('calls onThrow on Enter', () => {
    const { unmount } = mountOpen()
    keyDown('Enter', document.body)
    expect(onThrow).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
    unmount()
  })

  it('calls onClose on Escape', () => {
    const { unmount } = mountOpen()
    keyDown('Escape', document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onThrow).not.toHaveBeenCalled()
    unmount()
  })

  it('ignores Enter when combobox is open', () => {
    const { unmount } = mountOpen()
    const wrapper = document.createElement('div')
    wrapper.setAttribute('data-throw-combobox-open', 'true')
    const input = document.createElement('input')
    wrapper.appendChild(input)
    document.body.appendChild(wrapper)
    keyDown('Enter', input)
    document.body.removeChild(wrapper)
    expect(onThrow).not.toHaveBeenCalled()
    unmount()
  })

  it('ignores Enter when target is a select', () => {
    const { unmount } = mountOpen()
    const select = document.createElement('select')
    keyDown('Enter', select)
    expect(onThrow).not.toHaveBeenCalled()
    unmount()
  })
})
