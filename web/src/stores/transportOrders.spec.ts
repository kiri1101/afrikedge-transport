import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/http'
import { fetchTransportOrder, fetchTransportOrders, validateOrder } from '@/api/transportOrders'
import type { TransportOrderDetail } from '@/api/types'
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

const detail = (version: string, status: TransportOrderDetail['status'] = 'DRAFT'): TransportOrderDetail => ({
  no: 'TO-0003',
  version,
  status,
  deliveryDate: '2026-10-25',
  vehicleCode: 'VH-01',
  plateNo: 'LT-482-AB',
  capacityKg: 1500,
  lineCount: 2,
  totalWeightKg: 1360,
  createdBy: 'diane',
  validatedBy: null,
  remainingKg: 140,
  lines: [],
  allowedActions: ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE'],
})

describe('transport orders store (detail)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sends the version it shows and keeps the returned order', async () => {
    const store = useTransportOrdersStore()
    vi.mocked(fetchTransportOrder).mockResolvedValue(detail('AAAAAAAAAAAAAAA1'))
    vi.mocked(validateOrder).mockResolvedValue(detail('AAAAAAAAAAAAAAA2', 'VALIDATED'))
    await store.loadDetail('TO-0003')

    await store.validate()

    expect(validateOrder).toHaveBeenCalledWith('TO-0003', 'AAAAAAAAAAAAAAA1')
    expect(store.current?.status).toBe('VALIDATED')
  })

  it('reloads the order and raises a notice when its version is stale (412)', async () => {
    const store = useTransportOrdersStore()
    vi.mocked(fetchTransportOrder)
      .mockResolvedValueOnce(detail('AAAAAAAAAAAAAAA1'))
      .mockResolvedValueOnce(detail('AAAAAAAAAAAAAAA9'))
    vi.mocked(validateOrder).mockRejectedValue(new ApiError(412, 'STALE_VERSION', '', ''))
    await store.loadDetail('TO-0003')

    await store.validate()

    expect(store.staleNotice).toBe(true)
    expect(store.current?.version).toBe('AAAAAAAAAAAAAAA9')
  })
})
