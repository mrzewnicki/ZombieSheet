/**
 * Feature flags driven by Vite env variables.
 *
 * VITE_CHAT_ENABLED=true        — shows the chat sidebar with the message list.
 * VITE_CHAT_INPUT_ENABLED=true  — shows the input area so users can type messages.
 *                                  Requires VITE_CHAT_ENABLED=true to have any effect.
 *                                  When false, only system-generated messages (dice rolls etc.)
 *                                  can appear; the list is read-only for all users.
 */
export const FEATURES = {
  chat: import.meta.env.VITE_CHAT_ENABLED === 'true',
  chatInput: import.meta.env.VITE_CHAT_INPUT_ENABLED === 'true',
} as const
