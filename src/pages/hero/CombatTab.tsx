import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  ARMOR_CATEGORIES,
  armorSlotLimit,
  computeArmorSlotLimits,
  inUseArmorForCategory,
  resolveArmorCategory,
  sumArmorInUse,
} from '@/config/armorSlots'
import { ARMOR_DOC_URL } from '@/config/rpg-system'
import CombatFigure, {
  WEAPON_HAND_SLOTS,
  type CombatSlotRef,
} from '@/components/hero/CombatFigure'
import CombatMutationSlots from '@/components/hero/CombatMutationSlots'
import CombatSlotPicker from '@/components/hero/CombatSlotPicker'
import CombatSkillsPanel from '@/components/hero/CombatSkillsPanel'
import ThrowDialog, { type ThrowDialogInitial, type ThrowParams } from '@/components/hero/ThrowDialog'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Spinner from '@/components/ui/Spinner'
import { useChatContext } from '@/contexts/ChatContext'
import { useGearTraitCatalog } from '@/hooks/useGearTraitCatalog'
import { useHeroField } from '@/hooks/useHeroField'
import { useHeroOutletContext } from '@/hooks/useHeroOutletContext'
import { heroFullName, type ArmorItem, type HeroMutation, type WeaponItem } from '@/types'
import { rollDicePool } from '@/utils/diceRoll'
import { normalizeGearVisual } from '@/utils/gearVisual'
import { sortGearListItems } from '@/utils/gearListOrder'
import { normalizeMutation } from '@/utils/mutations'
import { computeInitiative } from '@/utils/vitals'

import { normalizeCombatSkillKeys } from '@/utils/combatSkills'

export default function CombatTab() {
  const { hero, gameId, heroId, canEdit } = useHeroOutletContext()
  const { t } = useTranslation()
  const { updateField } = useHeroField(gameId, heroId)
  const { pushContextMessage } = useChatContext()
  const [weapons, setWeapons] = useState<WeaponItem[]>([])
  const [armor, setArmor] = useState<ArmorItem[]>([])
  const [mutations, setMutations] = useState<HeroMutation[]>([])
  const [loading, setLoading] = useState({ weapons: true, armor: true, mutations: true })
  const [slotError, setSlotError] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<CombatSlotRef | null>(null)
  const [busy, setBusy] = useState(false)
  const [mutationBusyId, setMutationBusyId] = useState<string | null>(null)
  const [mutationDeleteTarget, setMutationDeleteTarget] = useState<HeroMutation | null>(null)
  const [throwDialog, setThrowDialog] = useState<ThrowDialogInitial | null>(null)
  const { traits: traitCatalog, loading: traitsLoading } = useGearTraitCatalog(gameId)

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'games', gameId, 'heroes', heroId, 'weapons'),
      (snap) => {
        const next = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          ...normalizeGearVisual(d.data()),
        } as WeaponItem))
        setWeapons(sortGearListItems(next))
        setLoading((l) => ({ ...l, weapons: false }))
      },
    )
    return unsub
  }, [gameId, heroId])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'games', gameId, 'heroes', heroId, 'armor'),
      (snap) => {
        const next = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          ...normalizeGearVisual(d.data()),
        } as ArmorItem))
        setArmor(sortGearListItems(next))
        setLoading((l) => ({ ...l, armor: false }))
      },
    )
    return unsub
  }, [gameId, heroId])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'games', gameId, 'heroes', heroId, 'mutations'),
      (snap) => {
        const next = snap.docs
          .map((d) => normalizeMutation(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => {
            const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER
            const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER
            if (orderA !== orderB) return orderA - orderB
            return a.name.localeCompare(b.name, 'pl')
          })
        setMutations(next)
        setLoading((l) => ({ ...l, mutations: false }))
      },
    )
    return unsub
  }, [gameId, heroId])

  const activeMutations = useMemo(
    () => mutations.filter((m) => m.character === 'aktywna'),
    [mutations],
  )
  const armorTotal = useMemo(() => sumArmorInUse(armor), [armor])
  const initiative = useMemo(
    () => computeInitiative(hero.attributes, hero.skills),
    [hero.attributes, hero.skills],
  )
  const slotLimits = useMemo(
    () => computeArmorSlotLimits(armor, traitCatalog),
    [armor, traitCatalog],
  )

  const weaponsInUse = useMemo(
    () => weapons.filter((item) => item.inUse),
    [weapons],
  )

  const weaponSlots = useMemo(() => (
    Array.from({ length: WEAPON_HAND_SLOTS }, (_, index) => ({
      kind: 'weapon' as const,
      index,
      item: weaponsInUse[index] ?? null,
      label: t(`combat.weaponSlots.${index}`),
    }))
  ), [weaponsInUse, t])

  const armorSlots = useMemo(() => (
    ARMOR_CATEGORIES.flatMap((category) => {
      const limit = armorSlotLimit(category, slotLimits)
      const equipped = inUseArmorForCategory(armor, category)
      return Array.from({ length: limit }, (_, index) => ({
        kind: 'armor' as const,
        category,
        index,
        item: equipped[index] ?? null,
        label: t(`inventory.armor.categories.${category}`),
      }))
    })
  ), [armor, slotLimits, t])

  const currentEquipped = useMemo(() => {
    if (!activeSlot) return null
    if (activeSlot.kind === 'weapon') {
      return weaponSlots[activeSlot.index]?.item ?? null
    }
    return armorSlots.find(
      (s) => s.category === activeSlot.category && s.index === activeSlot.index,
    )?.item ?? null
  }, [activeSlot, armorSlots, weaponSlots])

  const pickerItems = useMemo(() => {
    if (!activeSlot) return []
    if (activeSlot.kind === 'weapon') return weapons
    return armor.filter((item) => resolveArmorCategory(item) === activeSlot.category)
  }, [activeSlot, armor, weapons])

  const pickerTitle = useMemo(() => {
    if (!activeSlot) return ''
    if (activeSlot.kind === 'weapon') {
      return t('combat.pickerWeaponTitle', {
        slot: t(`combat.weaponSlots.${activeSlot.index}`),
      })
    }
    return t('combat.pickerArmorTitle', {
      category: t(`inventory.armor.categories.${activeSlot.category}`),
    })
  }, [activeSlot, t])

  const handleThrow = useCallback((params: ThrowParams) => {
    const { rolls, result, diceCount } = rollDicePool(params.total)
    const label = params.skillLabel || params.attributeLabel
    const key = params.skillKey || params.attributeKey
    void pushContextMessage({
      type: 'dice_roll',
      heroId,
      heroName: heroFullName(hero),
      data: {
        key,
        label,
        skillKey: params.skillKey,
        skillLabel: params.skillLabel,
        skillValue: params.skillValue,
        attributeKey: params.attributeKey,
        attributeLabel: params.attributeLabel,
        attributeValue: params.attributeValue,
        modifier: params.modifier,
        total: params.total,
        rolls,
        result,
        diceCount,
      },
    })
    setThrowDialog(null)
  }, [pushContextMessage, heroId, hero])

  async function handleSkillChange(key: string, value: number) {
    const label = t(`skills.${key}`, { defaultValue: key })
    await updateField(`skills.${key}`, label, value, hero.skills[key] ?? 0)
  }

  async function handleCombatSkillKeysChange(next: string[], prev: string[]) {
    await updateField('combatSkillKeys', t('combat.skillsFieldLabel'), next, prev)
  }

  const combatSkillKeys = normalizeCombatSkillKeys(hero.combatSkillKeys)

  async function setInUse(
    kind: 'weapon' | 'armor',
    id: string,
    inUse: boolean,
  ) {
    const path = kind === 'weapon' ? 'weapons' : 'armor'
    await updateDoc(doc(db, 'games', gameId, 'heroes', heroId, path, id), { inUse })
  }

  /**
   * Replace slot contents: unequip current (if any), equip chosen (if not already).
   * Choosing an already-equipped item just frees the current slot.
   */
  async function replaceSlot(
    kind: 'weapon' | 'armor',
    current: { id: string } | null,
    next: { id: string; inUse?: boolean },
  ) {
    if (current?.id === next.id) return
    if (current && next.inUse) {
      await setInUse(kind, current.id, false)
      return
    }
    if (current && !next.inUse) {
      await setInUse(kind, current.id, false)
      await setInUse(kind, next.id, true)
      return
    }
    if (!current && !next.inUse) {
      await setInUse(kind, next.id, true)
    }
  }

  async function handlePick(item: ArmorItem | WeaponItem) {
    if (!activeSlot || !canEdit) return
    setBusy(true)
    setSlotError(null)
    try {
      const kind = activeSlot.kind === 'weapon' ? 'weapon' : 'armor'
      await replaceSlot(kind, currentEquipped, item)
      setActiveSlot(null)
    } catch {
      setSlotError(t('combat.swapError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleUnequip() {
    if (!activeSlot || !canEdit || !currentEquipped) return
    setBusy(true)
    setSlotError(null)
    try {
      const kind = activeSlot.kind === 'weapon' ? 'weapon' : 'armor'
      await setInUse(kind, currentEquipped.id, false)
      setActiveSlot(null)
    } catch {
      setSlotError(t('combat.swapError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleMutationHibernation(item: HeroMutation) {
    if (!canEdit) return
    setMutationBusyId(item.id)
    try {
      await updateDoc(
        doc(db, 'games', gameId, 'heroes', heroId, 'mutations', item.id),
        { hibernating: !item.hibernating },
      )
    } catch {
      setSlotError(t('combat.mutationHibernateError'))
    } finally {
      setMutationBusyId(null)
    }
  }

  async function handleRemoveMutation() {
    if (!canEdit || !mutationDeleteTarget) return
    setMutationBusyId(mutationDeleteTarget.id)
    setSlotError(null)
    try {
      await deleteDoc(
        doc(db, 'games', gameId, 'heroes', heroId, 'mutations', mutationDeleteTarget.id),
      )
      setMutationDeleteTarget(null)
    } catch {
      setSlotError(t('combat.mutationDeleteError'))
    } finally {
      setMutationBusyId(null)
    }
  }

  if (loading.weapons || loading.armor || loading.mutations || traitsLoading) {
    return <div className="flex justify-center py-8"><Spinner /></div>
  }

  const overflowWeapons = weaponsInUse.slice(WEAPON_HAND_SLOTS)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg text-blood-light tracking-wide">
            {t('combat.title')}
          </h2>
          <p className="text-sm text-ink-muted mt-1">{t('combat.subtitle')}</p>
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p
            className="text-sm font-mono text-ink tabular-nums"
            title={t('combat.initiativeFormula')}
          >
            {t('combat.initiative', { value: initiative })}
          </p>
          <p className="text-[10px] text-ink-faint leading-tight max-w-[14rem]">
            {t('combat.initiativeFormula')}
          </p>
          <p className="text-xs font-mono text-ink-muted pt-1">
            {t('inventory.armor.inUseTotal', { value: armorTotal })}
          </p>
          <a
            href={ARMOR_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blood-light hover:text-blood transition-colors"
          >
            {t('vitals.readMore')}
          </a>
        </div>
      </div>

      {slotError && (
        <p className="text-xs text-blood leading-relaxed">{slotError}</p>
      )}

      <div className="flex flex-col lg:flex-row gap-6 lg:items-stretch">
        <div className="relative z-20 rounded-lg border border-border bg-surface/60 p-2 sm:p-2.5 w-full max-w-md mx-auto lg:mx-0 shrink-0">
          <CombatFigure
            armorSlots={armorSlots}
            weaponSlots={weaponSlots}
            traitCatalog={traitCatalog}
            canEdit={canEdit}
            onSlotClick={(slot) => {
              if (!canEdit) return
              setSlotError(null)
              setActiveSlot(slot)
            }}
          />
        </div>

        <CombatSkillsPanel
          className="relative z-0 flex-1 min-w-0 w-full min-h-0 lg:h-auto"
          combatSkillKeys={combatSkillKeys}
          values={hero.skills}
          canEdit={canEdit}
          onSkillChange={handleSkillChange}
          onSkillClick={(key) => setThrowDialog({ skillKey: key })}
          onSaveKeys={handleCombatSkillKeysChange}
        />
      </div>

      {overflowWeapons.length > 0 && (
        <p className="text-xs text-ink-faint text-center lg:text-left">
          {t('combat.weaponOverflow', { count: overflowWeapons.length })}
          {': '}
          {overflowWeapons.map((w) => w.name).join(', ')}
        </p>
      )}

      <CombatMutationSlots
        items={activeMutations}
        canEdit={canEdit}
        busyId={mutationBusyId}
        onToggleHibernating={(item) => void handleToggleMutationHibernation(item)}
        onRemove={(item) => setMutationDeleteTarget(item)}
      />

      <ConfirmDialog
        open={mutationDeleteTarget !== null}
        message={t('mutations.deleteConfirm', { name: mutationDeleteTarget?.name ?? '' })}
        onConfirm={() => void handleRemoveMutation()}
        onCancel={() => setMutationDeleteTarget(null)}
        confirmLoading={mutationBusyId === mutationDeleteTarget?.id}
        dangerous
      />

      <CombatSlotPicker
        open={activeSlot != null}
        title={pickerTitle}
        subtitle={t('combat.pickerHint')}
        items={pickerItems}
        currentId={currentEquipped?.id ?? null}
        kind={activeSlot?.kind === 'weapon' ? 'weapon' : 'armor'}
        traitCatalog={traitCatalog}
        onPick={(item) => void handlePick(item)}
        onUnequip={() => void handleUnequip()}
        onClose={() => setActiveSlot(null)}
        busy={busy}
      />

      <ThrowDialog
        open={throwDialog !== null}
        initial={throwDialog}
        skills={hero.skills}
        attributes={hero.attributes}
        onClose={() => setThrowDialog(null)}
        onThrow={handleThrow}
      />
    </div>
  )
}
