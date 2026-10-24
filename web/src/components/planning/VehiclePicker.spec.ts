import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Vehicle } from '@/api/types'
import { testGlobal } from '@/test-utils'
import VehiclePicker from './VehiclePicker.vue'

const vehicles: Vehicle[] = [
  { code: 'VH-01', plateNo: 'LT-482-AB', capacityKg: 1500, active: true },
  { code: 'VH-09', plateNo: 'LT-810-ST', capacityKg: 1200, active: true },
  { code: 'VH-10', plateNo: 'CE-093-UV', capacityKg: 2000, active: true },
]

const row = (wrapper: ReturnType<typeof mount>, code: string) => wrapper.get(`[data-vehicle="${code}"]`)

describe('VehiclePicker', () => {
  it('disables a vehicle already booked that day with the order number', () => {
    const wrapper = mount(VehiclePicker, {
      props: { vehicles, booked: { 'VH-01': 'TO-0003' }, minCapacityKg: 0, modelValue: null },
      global: testGlobal,
    })

    expect(row(wrapper, 'VH-01').attributes('aria-disabled')).toBe('true')
    expect(row(wrapper, 'VH-01').text()).toContain('TO-0003')
    expect(row(wrapper, 'VH-10').attributes('aria-disabled')).not.toBe('true')
  })

  it('disables a vehicle too small for the selection', () => {
    const wrapper = mount(VehiclePicker, {
      props: { vehicles, booked: {}, minCapacityKg: 1500, modelValue: null },
      global: testGlobal,
    })

    expect(row(wrapper, 'VH-09').attributes('aria-disabled')).toBe('true')
    expect(row(wrapper, 'VH-01').attributes('aria-disabled')).not.toBe('true')
  })
})
