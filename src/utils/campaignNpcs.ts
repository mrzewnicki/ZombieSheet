import type { CampaignNpc } from '@/types'

export const CAMPAIGN_NPCS_COLLECTION = 'npcs'

export function newCampaignNpc(createdByUid: string): CampaignNpc {
  return {
    id: crypto.randomUUID(),
    name: '',
    role: '',
    imageURL: '',
    notes: '',
    createdByUid,
  }
}

export function normalizeCampaignNpc(
  id: string,
  raw: Record<string, unknown> | undefined | null,
): CampaignNpc {
  const src = raw ?? {}
  return {
    id,
    name: typeof src.name === 'string' ? src.name : '',
    role: typeof src.role === 'string' ? src.role : '',
    imageURL: typeof src.imageURL === 'string' ? src.imageURL : '',
    notes: typeof src.notes === 'string' ? src.notes : '',
    createdByUid: typeof src.createdByUid === 'string' ? src.createdByUid : undefined,
  }
}

/** Payload for create/update. Prefer an explicit uid so creates never omit createdByUid. */
export function campaignNpcPayload(
  npc: CampaignNpc,
  options?: { preserveCreatedByUid?: string; createdByUid?: string },
) {
  const createdByUid =
    options?.createdByUid
    ?? npc.createdByUid
    ?? options?.preserveCreatedByUid
    ?? ''
  return {
    name: npc.name.trim(),
    role: npc.role.trim(),
    imageURL: npc.imageURL.trim(),
    notes: npc.notes.trim(),
    createdByUid,
  }
}
