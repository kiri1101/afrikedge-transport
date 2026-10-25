import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ToastService from 'primevue/toastservice'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import { addLines, fetchTransportOrders } from '@/api/transportOrders'
import { fetchVehicles } from '@/api/vehicles'
import type { SalesOrder, TransportOrderDetail, TransportOrderSummary } from '@/api/types'
import { testGlobal } from '@/test-utils'
import AddToTransportDialog from './AddToTransportDialog.vue'

vi.mock('@/api/transportOrders', () => ({
  fetchTransportOrders: vi.fn<() => Promise<unknown>>(),
  addLines: vi.fn<() => Promise<TransportOrderDetail>>(),
  createTransportOrder: vi.fn<() => Promise<unknown>>(),
}))
vi.mock('@/api/vehicles', () => ({ fetchVehicles: vi.fn<() => Promise<unknown>>() }))

const selection: SalesOrder[] = [
  { no: 'SO-1008', customerNo: 'C0001', customerName: 'Quincaillerie Ndokoti', deliveryCity: 'Douala', totalWeightKg: 430, status: 'TO_PLAN' },
]

describe('AddToTransportDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchVehicles).mockResolvedValue([])
    vi.mocked(fetchTransportOrders).mockResolvedValue({
      items: [
        {
          no: 'TO-0004',
          version: '00000000000007D4',
          status: 'DRAFT',
          deliveryDate: '2026-10-26',
          vehicleCode: 'VH-04',
          plateNo: 'LT-905-GH',
          capacityKg: 5000,
          lineCount: 0,
          totalWeightKg: 0,
          createdBy: 'eric',
          validatedBy: null,
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
    })
  })

  it('disables the submit button while the request is pending', async () => {
    vi.mocked(addLines).mockReturnValue(new Promise<TransportOrderDetail>(() => {}))
    const wrapper = mount(AddToTransportDialog, {
      props: { visible: true, selection },
      global: { ...testGlobal, plugins: [...testGlobal.plugins, ToastService as never] },
    })
    await flushPromises()

    const submit = wrapper.get('[data-testid="submit"]')
    expect(submit.attributes('disabled')).toBeUndefined()
    await submit.trigger('click')

    expect(addLines).toHaveBeenCalledWith('TO-0004', '00000000000007D4', ['SO-1008'])
    expect(wrapper.get('[data-testid="submit"]').attributes('disabled')).toBeDefined()
  })

  it('does not switch to another draft after a stale version', async () => {
    const draft = (no: string, totalWeightKg: number): TransportOrderSummary => ({
      no,
      version: '00000000000007D4',
      status: 'DRAFT',
      deliveryDate: '2026-10-26',
      vehicleCode: 'VH-04',
      plateNo: 'LT-905-GH',
      capacityKg: 5000,
      lineCount: totalWeightKg > 0 ? 1 : 0,
      totalWeightKg,
      createdBy: 'eric',
      validatedBy: null,
    })
    let draftLoads = 0
    vi.mocked(fetchTransportOrders).mockImplementation(async (query) => {
      if (query.status !== 'DRAFT') return { items: [], page: 1, pageSize: 100, total: 0 }
      draftLoads++
      // After the 412, TO-0004 is nearly full and another draft fits.
      const items = draftLoads === 1 ? [draft('TO-0004', 0)] : [draft('TO-0004', 4900), draft('TO-0009', 0)]
      return { items, page: 1, pageSize: 100, total: items.length }
    })
    vi.mocked(addLines).mockRejectedValue(new ApiError(412, 'STALE_VERSION', '', ''))
    const wrapper = mount(AddToTransportDialog, {
      props: { visible: true, selection },
      global: { ...testGlobal, plugins: [...testGlobal.plugins, ToastService as never] },
    })
    await flushPromises()

    await wrapper.get('[data-testid="submit"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="submit"]').attributes('disabled')).toBeDefined()
  })
})
