import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchToPlan, fetchToPlanCities } from '@/api/salesOrders'
import type { Page, SalesOrder } from '@/api/types'
import { toHundredths } from '@/utils/weights'

/**
 * Orders to plan and the dispatcher's selection. The selection lives here, not in the table,
 * so it survives server-side page changes; changing the city starts over.
 */
export const useSalesOrdersStore = defineStore('salesOrders', () => {
  const city = ref<string | null>(null)
  const page = ref(1)
  const pageSize = ref(10)
  const result = ref<Page<SalesOrder> | null>(null)
  const cities = ref<string[]>([])
  const loading = ref(false)
  const error = ref<unknown>(null)
  const selected = ref<Record<string, SalesOrder>>({})

  const selection = computed(() => Object.values(selected.value))
  const selectedWeightKg = computed(
    () => selection.value.reduce((sum, order) => sum + toHundredths(order.totalWeightKg), 0) / 100,
  )
  const isSelected = (no: string) => no in selected.value

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      result.value = await fetchToPlan({ city: city.value, page: page.value, pageSize: pageSize.value })
      // Planning the last orders of the last page leaves it empty: step back to the new last page.
      if (result.value.items.length === 0 && page.value > 1) {
        page.value = Math.max(1, Math.ceil(result.value.total / pageSize.value))
        result.value = await fetchToPlan({ city: city.value, page: page.value, pageSize: pageSize.value })
      }
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  async function loadCities(): Promise<void> {
    try {
      cities.value = await fetchToPlanCities()
    } catch {
      // The filter just stays empty; the list itself reports an unreachable API.
      cities.value = []
    }
  }

  async function setCity(value: string | null): Promise<void> {
    city.value = value
    page.value = 1
    selected.value = {}
    await load()
  }

  async function setPage(value: number, size: number): Promise<void> {
    page.value = value
    pageSize.value = size
    await load()
  }

  function toggle(order: SalesOrder): void {
    if (isSelected(order.no)) {
      const { [order.no]: _removed, ...rest } = selected.value
      selected.value = rest
    } else {
      selected.value = { ...selected.value, [order.no]: order }
    }
  }

  /** Header checkbox: select or unselect every order of the current page. */
  function togglePage(checked: boolean): void {
    const next = { ...selected.value }
    for (const order of result.value?.items ?? []) {
      if (checked) next[order.no] = order
      else delete next[order.no]
    }
    selected.value = next
  }

  function clearSelection(): void {
    selected.value = {}
  }

  return {
    city,
    page,
    pageSize,
    result,
    cities,
    loading,
    error,
    selection,
    selectedWeightKg,
    isSelected,
    load,
    loadCities,
    setCity,
    setPage,
    toggle,
    togglePage,
    clearSelection,
  }
})
