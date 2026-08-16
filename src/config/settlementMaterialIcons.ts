import type { IconType } from 'react-icons'
import {
  GiBubblingFlask,
  GiElectric,
  GiHammerNails,
  GiMetalBar,
  GiRolledCloth,
  GiShatteredGlass,
  GiStonePile,
  GiWoodPile,
} from 'react-icons/gi'
import type { SettlementMaterialKey } from '@/config/settlementMaterials'

export const SETTLEMENT_MATERIAL_ICONS: Record<SettlementMaterialKey, IconType> = {
  drewno: GiWoodPile,
  spoiwa: GiHammerNails,
  kamien: GiStonePile,
  metal: GiMetalBar,
  chemia: GiBubblingFlask,
  elektryka: GiElectric,
  szklo: GiShatteredGlass,
  tkanina: GiRolledCloth,
}
