import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError } from '@/api/http'
import { departOrder, fetchTransportOrder, fetchTransportOrders, removeLine as removeLineApi, validateOrder } from '@/api/transportOrders'
import type { Page, TransportOrderDetail, TransportOrderStatus, TransportOrderSummary } from '@/api/types'

/**
 * The transport orders list (any filter change goes back to page 1) and the order on screen.
 * Changes to that order always send the version it shows (If-Match).
 */
export const useTransportOrdersStore = defineStore('transportOrders', () => {
  const status = ref<TransportOrderStatus | null>(null)
  const deliveryDate = ref<string | null>(null)
  const page = ref(1)
  const pageSize = ref(10)
  const result = ref<Page<TransportOrderSummary> | null>(null)
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      result.value = await fetchTransportOrders({
        status: status.value,
        deliveryDate: deliveryDate.value,
        page: page.value,
        pageSize: pageSize.value,
      })
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  async function setStatus(value: TransportOrderStatus | null): Promise<void> {
    status.value = value
    page.value = 1
    await load()
  }

  async function setDeliveryDate(value: string | null): Promise<void> {
    deliveryDate.value = value
    page.value = 1
    await load()
  }

  async function setPage(value: number, size: number): Promise<void> {
    page.value = value
    pageSize.value = size
    await load()
  }

  // ---- order detail

  const current = ref<TransportOrderDetail | null>(null)
  const detailLoading = ref(false)
  const detailError = ref<unknown>(null)
  /** Set when a change hit a stale version: the order was reloaded and the user should look again. */
  const staleNotice = ref(false)
  /** A change is in flight: actions are disabled so a second click cannot fire with the old version. */
  const busy = ref(false)

  async function loadDetail(no: string): Promise<void> {
    detailLoading.value = true
    detailError.value = null
    staleNotice.value = false
    try {
      current.value = await fetchTransportOrder(no)
    } catch (e) {
      current.value = null
      detailError.value = e
    } finally {
      detailLoading.value = false
    }
  }

  /** Runs a change on the current order; on 412 reloads it and raises the notice, other errors propagate. */
  async function change(action: (order: TransportOrderDetail) => Promise<TransportOrderDetail>): Promise<boolean> {
    const order = current.value!
    busy.value = true
    try {
      current.value = await action(order)
      staleNotice.value = false
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 412) {
        await loadDetail(order.no)
        staleNotice.value = true
        return false
      }
      throw e
    } finally {
      busy.value = false
    }
  }

  const removeLine = (salesOrderNo: string) => change((o) => removeLineApi(o.no, o.version, salesOrderNo))
  const validate = () => change((o) => validateOrder(o.no, o.version))
  const depart = () => change((o) => departOrder(o.no, o.version))

  async function clearFilters(): Promise<void> {
    status.value = null
    deliveryDate.value = null
    page.value = 1
    await load()
  }

  return {
    status,
    deliveryDate,
    page,
    pageSize,
    result,
    loading,
    error,
    load,
    setStatus,
    setDeliveryDate,
    setPage,
    clearFilters,
    current,
    detailLoading,
    detailError,
    staleNotice,
    busy,
    loadDetail,
    removeLine,
    validate,
    depart,
  }
})
