import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchToPlan } from '@/api/salesOrders'
import type { SalesOrder } from '@/api/types'
import { useSalesOrdersStore } from './salesOrders'

vi.mock('@/api/salesOrders', () => ({
  fetchToPlan: vi.fn<() => Promise<unknown>>(),
  fetchToPlanCities: vi.fn<() => Promise<string[]>>(),
}))

const order = (no: string, totalWeightKg: number): SalesOrder => ({
  no,
  customerNo: 'C0001',
  customerName: 'Client',
  deliveryCity: 'Douala',
  totalWeightKg,
  status: 'TO_PLAN',
})

describe('sales orders store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchToPlan).mockReset().mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0 })
  })

  it('keeps the selection across pages', async () => {
    const store = useSalesOrdersStore()
    store.toggle(order('SO-1008', 430))

    await store.setPage(2, 10)

    expect(store.selection.map((o) => o.no)).toEqual(['SO-1008'])
    expect(fetchToPlan).toHaveBeenLastCalledWith({ city: null, page: 2, pageSize: 10 })
  })

  it('resets page and selection when the city changes', async () => {
    const store = useSalesOrdersStore()
    store.toggle(order('SO-1008', 430))
    await store.setPage(2, 10)

    await store.setCity('Kribi')

    expect(store.page).toBe(1)
    expect(store.selection).toEqual([])
    expect(fetchToPlan).toHaveBeenLastCalledWith({ city: 'Kribi', page: 1, pageSize: 10 })
  })

  it('sums the selected weight exactly', () => {
    const store = useSalesOrdersStore()
    store.toggle(order('SO-1008', 430))
    store.toggle(order('SO-1011', 260))
    store.toggle(order('SO-1013', 145.5))

    expect(store.selectedWeightKg).toBe(835.5)
  })

  it('unselects an order toggled twice', () => {
    const store = useSalesOrdersStore()
    store.toggle(order('SO-1008', 430))
    store.toggle(order('SO-1008', 430))

    expect(store.selection).toEqual([])
  })

  it('keeps the load error for the screen to show', async () => {
    const store = useSalesOrdersStore()
    vi.mocked(fetchToPlan).mockRejectedValue(new Error('down'))

    await store.load()

    expect(store.error).toBeInstanceOf(Error)
    expect(store.loading).toBe(false)
  })
})
