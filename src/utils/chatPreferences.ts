export const CHAT_SIDEBAR_LS_KEY = 'chat_sidebar_open'

/** Returns true unless the user explicitly collapsed the sidebar. */
export function loadChatSidebarOpen(): boolean {
  try {
    return localStorage.getItem(CHAT_SIDEBAR_LS_KEY) !== 'false'
  } catch {
    return true
  }
}
