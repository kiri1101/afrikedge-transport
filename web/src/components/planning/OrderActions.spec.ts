import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Role, TransportOrderAction, TransportOrderDetail, TransportOrderStatus } from '@/api/types'
import { testGlobal } from '@/test-utils'
import OrderActions from './OrderActions.vue'

function order(status: TransportOrderStatus, lineCount: number, allowedActions: TransportOrderAction[]): TransportOrderDetail {
  return {
    no: 'TO-0003',
    version: '00000000000007D3',
    status,
    deliveryDate: '2026-10-25',
    vehicleCode: 'VH-01',
    plateNo: 'LT-482-AB',
    capacityKg: 1500,
    lineCount,
    totalWeightKg: lineCount > 0 ? 1360 : 0,
    createdBy: 'diane',
    validatedBy: status === 'DRAFT' ? null : 'eric',
    remainingKg: lineCount > 0 ? 140 : 1500,
    lines: [],
    allowedActions,
  }
}

const mountWith = (role: Role, detail: TransportOrderDetail) =>
  mount(OrderActions, { props: { order: detail, role }, global: testGlobal })

const buttonLabels = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('button').map((b) => b.text())

describe('OrderActions', () => {
  it('hides Validate from a dispatcher and explains why', () => {
    const wrapper = mountWith('DISPATCHER', order('DRAFT', 2, ['ADD_LINES', 'REMOVE_LINES']))

    expect(buttonLabels(wrapper).some((label) => label.includes('Valider'))).toBe(false)
    expect(wrapper.text()).toContain('responsable logistique')
  })

  it('shows Validate to a manager on a draft with lines', () => {
    const wrapper = mountWith('LOGISTICS_MANAGER', order('DRAFT', 2, ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE']))

    expect(buttonLabels(wrapper)).toContain("Valider l'ordre")
  })

  it('explains that an empty order cannot be validated', () => {
    const wrapper = mountWith('LOGISTICS_MANAGER', order('DRAFT', 0, ['ADD_LINES']))

    expect(wrapper.text()).toContain('au moins une commande')
  })

  it('offers Depart on a validated order', () => {
    const wrapper = mountWith('DISPATCHER', order('VALIDATED', 3, ['DEPART']))

    expect(buttonLabels(wrapper)).toContain('Marquer parti')
  })

  it('emits validate when clicked', async () => {
    const wrapper = mountWith('LOGISTICS_MANAGER', order('DRAFT', 2, ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE']))

    await wrapper.findAll('button').find((b) => b.text() === "Valider l'ordre")!.trigger('click')

    expect(wrapper.emitted('validate')).toHaveLength(1)
  })

  it('disables the actions while a change is in flight', () => {
    const wrapper = mount(OrderActions, {
      props: { order: order('DRAFT', 2, ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE']), role: 'LOGISTICS_MANAGER', busy: true },
      global: testGlobal,
    })

    const validate = wrapper.findAll('button').find((b) => b.text().includes('Valider'))!
    expect(validate.attributes('disabled')).toBeDefined()
  })
})
