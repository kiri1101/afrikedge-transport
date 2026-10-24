import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchTransportOrders } from '@/api/transportOrders'
import { useTransportOrdersStore } from './transportOrders'

vi.mock('@/api/transportOrders', () => ({
  fetchTransportOrders: vi.fn<() => Promise<unknown>>(),
  fetchTransportOrder: vi.fn<() => Promise<unknown>>(),
  removeLine: vi.fn<() => Promise<unknown>>(),
  validateOrder: vi.fn<() => Promise<unknown>>(),
  departOrder: vi.fn<() => Promise<unknown>>(),
}))

describe('transport orders store (list)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetchTransportOrders).mockReset().mockResolvedValue({ items: [], page: 1, pageSize: 10, total: 0 })
  })

  it('goes back to page 1 when the status filter changes', async () => {
    const store = useTransportOrdersStore()
    await store.setPage(2, 10)

    await store.setStatus('DRAFT')

    expect(store.page).toBe(1)
    expect(fetchTransportOrders).toHaveBeenLastCalledWith({ status: 'DRAFT', deliveryDate: null, page: 1, pageSize: 10 })
  })

  it('goes back to page 1 when the date filter changes', async () => {
    const store = useTransportOrdersStore()
    await store.setPage(3, 10)

    await store.setDeliveryDate('2026-10-26')

    expect(fetchTransportOrders).toHaveBeenLastCalledWith({
      status: null,
      deliveryDate: '2026-10-26',
      page: 1,
      pageSize: 10,
    })
  })
})
