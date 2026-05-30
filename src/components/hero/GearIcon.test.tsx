import { render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import GearIcon from '@/components/hero/GearIcon'
import { loadGiIconComponent } from '@/utils/gearIcons'
import { createElement, isValidElement } from 'react'

describe('GearIcon', () => {
  it('loads a GI export as a component function', async () => {
    const Icon = await loadGiIconComponent('GiAncientSword')
    expect(typeof Icon).toBe('function')
    expect(isValidElement(Icon)).toBe(false)
    const el = Icon ? Icon({}) : null
    expect(isValidElement(el)).toBe(true)
  })

  it('renders a game icon without throwing', async () => {
    render(<GearIcon value="gi:GiAncientSword" className="test-icon" />)
    await waitFor(() => {
      expect(document.querySelector('svg.test-icon')).toBeTruthy()
    })
  })

  it('renders many icons like the picker list', async () => {
    const ids = ['GiAncientSword', 'GiBloodySword', 'GiBattleAxe', 'GiShield']
    const { container } = render(
      <div>
        {ids.map((id) => (
          <GearIcon key={id} value={`gi:${id}`} />
        ))}
      </div>,
    )
    await waitFor(() => {
      expect(container.querySelectorAll('svg').length).toBe(ids.length)
    })
  })

  it('createElement works with loaded icon', async () => {
    const Icon = await loadGiIconComponent('GiAncientSword')
    expect(Icon).toBeTruthy()
    const { container } = render(createElement(Icon!, { className: 'direct' }))
    expect(container.querySelector('svg.direct')).toBeTruthy()
  })
})
