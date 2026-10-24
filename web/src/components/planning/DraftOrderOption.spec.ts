import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { TransportOrderSummary } from '@/api/types'
import { testGlobal } from '@/test-utils'
import DraftOrderOption from './DraftOrderOption.vue'

const summary = (over: Partial<TransportOrderSummary>): TransportOrderSummary => ({
  no: 'TO-0003',
  version: '00000000000007D3',
  status: 'DRAFT',
  deliveryDate: '2026-10-25',
  vehicleCode: 'VH-01',
  plateNo: 'LT-482-AB',
  capacityKg: 1500,
  lineCount: 2,
  totalWeightKg: 1360,
  createdBy: 'diane',
  validatedBy: null,
  ...over,
})

describe('DraftOrderOption', () => {
  it('disables a draft the selection does not fit in and shows the excess', () => {
    const wrapper = mount(DraftOrderOption, {
      props: { order: summary({}), addKg: 835.5, selected: false },
      global: testGlobal,
    })

    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.text().replace(/\s/g, ' ')).toContain('695,50')
  })

  it('enables a draft with room', () => {
    const wrapper = mount(DraftOrderOption, {
      props: {
        order: summary({ no: 'TO-0004', capacityKg: 5000, totalWeightKg: 0, lineCount: 0 }),
        addKg: 835.5,
        selected: false,
      },
      global: testGlobal,
    })

    expect(wrapper.attributes('aria-disabled')).not.toBe('true')
  })
})
