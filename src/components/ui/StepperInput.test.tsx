import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StepperInput from './StepperInput'

describe('StepperInput', () => {
  afterEach(() => {
    cleanup()
  })

  it('increments and decrements numeric value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <StepperInput
        value="5"
        onChange={onChange}
        decreaseLabel="Decrease"
        increaseLabel="Increase"
      />,
    )

    await user.click(screen.getByLabelText('Increase'))
    expect(onChange).toHaveBeenCalledWith('6')

    await user.click(screen.getByLabelText('Decrease'))
    expect(onChange).toHaveBeenLastCalledWith('4')
  })

  it('treats non-numeric value as zero before stepping', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <StepperInput
        value=""
        onChange={onChange}
        decreaseLabel="Decrease"
        increaseLabel="Increase"
      />,
    )

    await user.click(screen.getByLabelText('Increase'))
    expect(onChange).toHaveBeenCalledWith('1')
  })
})
