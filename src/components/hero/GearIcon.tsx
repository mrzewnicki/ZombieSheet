import { createElement, useEffect, useState } from 'react'
import type { IconType } from 'react-icons'
import { loadGiIconComponent, parseGearIcon } from '@/utils/gearIcons'

interface Props {
  value: string
  className?: string
}

export default function GearIcon({ value, className = '' }: Props) {
  const [loadedIcon, setLoadedIcon] = useState<IconType | null>(null)
  const trimmed = value.trim()
  const parsed = parseGearIcon(trimmed)

  useEffect(() => {
    if (parsed?.set !== 'gi') {
      setLoadedIcon(null)
      return
    }

    let active = true
    loadGiIconComponent(parsed.id).then((Icon) => {
      if (active) setLoadedIcon(() => Icon)
    })
    return () => {
      active = false
    }
  }, [parsed?.id, parsed?.set])

  if (!trimmed) return null

  if (parsed?.set === 'gi') {
    if (!loadedIcon) return null
    return createElement(loadedIcon, { className, 'aria-hidden': true })
  }

  if (parsed?.set === 'ra') {
    return <i className={`ra ra-${parsed.id} ${className}`.trim()} aria-hidden />
  }

  return <span className={className} aria-hidden>{trimmed}</span>
}
