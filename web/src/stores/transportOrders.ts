import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchTransportOrders } from '@/api/transportOrders'
import type { Page, TransportOrderStatus, TransportOrderSummary } from '@/api/types'

/** The transport orders list and its filters; any filter change goes back to page 1. */
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
  }
})
