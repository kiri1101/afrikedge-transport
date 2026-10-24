import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LoadBar from './LoadBar.vue'

const to3 = [
  { key: 'SO-1006', label: 'SO-1006', kg: 640 },
  { key: 'SO-1007', label: 'SO-1007', kg: 720 },
]

// The DOM normalises '48.00%' to '48%': compare the percentages as numbers.
const widths = (wrapper: ReturnType<typeof mount>, selector: string) =>
  wrapper.findAll(selector).map((el) => parseFloat((el.element as HTMLElement).style.width))

describe('LoadBar', () => {
  it('draws one segment per order with exact widths', () => {
    const wrapper = mount(LoadBar, { props: { segments: to3, capacityKg: 1500 } })

    expect(widths(wrapper, '[data-segment]')).toEqual([42.67, 48])
  })

  it('turns amber above 85 %', () => {
    const wrapper = mount(LoadBar, { props: { segments: to3, capacityKg: 1500 } })

    expect(wrapper.get('[role="meter"]').attributes('data-level')).toBe('warn')
  })

  it('shows a hatched projection that fits', () => {
    const wrapper = mount(LoadBar, { props: { segments: [], capacityKg: 5000, projectedKg: 835.5 } })

    expect(widths(wrapper, '[data-projected]')).toEqual([16.71])
    expect(wrapper.find('[data-over]').exists()).toBe(false)
  })

  it('marks the overflowing part in red', () => {
    const wrapper = mount(LoadBar, { props: { segments: to3, capacityKg: 1500, projectedKg: 835.5 } })

    expect(wrapper.find('[data-over]').exists()).toBe(true)
    expect(wrapper.get('[role="meter"]').attributes('aria-valuenow')).toBe('2195.5')
  })
})
