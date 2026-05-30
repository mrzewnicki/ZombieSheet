import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CHAT_SIDEBAR_LS_KEY, loadChatSidebarOpen } from './chatPreferences'

describe('loadChatSidebarOpen', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to open when unset', () => {
    expect(loadChatSidebarOpen()).toBe(true)
  })

  it('returns false when explicitly collapsed', () => {
    localStorage.setItem(CHAT_SIDEBAR_LS_KEY, 'false')
    expect(loadChatSidebarOpen()).toBe(false)
  })

  it('stays open for other stored values', () => {
    localStorage.setItem(CHAT_SIDEBAR_LS_KEY, 'true')
    expect(loadChatSidebarOpen()).toBe(true)
  })
})
