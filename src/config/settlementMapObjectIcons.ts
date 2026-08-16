import type { IconType } from 'react-icons'
import {
  GiDeer,
  GiForest,
  GiStonePile,
  GiWaterDrop,
} from 'react-icons/gi'
import type { SettlementMapObjectKey } from '@/config/settlementMapObjects'

const KEY_ICONS: Record<SettlementMapObjectKey, IconType> = {
  las: GiForest,
  kamienie: GiStonePile,
  woda: GiWaterDrop,
  zwierzeta: GiDeer,
}

export function settlementMapObjectIcon(key: string): IconType {
  return KEY_ICONS[key as SettlementMapObjectKey] ?? GiForest
}
