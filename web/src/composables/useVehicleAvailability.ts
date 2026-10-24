import { ref } from 'vue'
import { fetchTransportOrders } from '@/api/transportOrders'
import type { Vehicle } from '@/api/types'
import { fetchVehicles } from '@/api/vehicles'
import { todayIso } from '@/utils/dates'

/**
 * Active vehicles and, for the chosen delivery date, which ones already have an order (R2).
 * Shared by the add-to-transport and new-order dialogs.
 */
export function useVehicleAvailability() {
  const vehicles = ref<Vehicle[]>([])
  /** vehicleCode → transport order already planned on `deliveryDate`. */
  const booked = ref<Record<string, string>>({})
  const deliveryDate = ref(todayIso())

  async function loadBooked(): Promise<void> {
    const page = await fetchTransportOrders({ status: null, deliveryDate: deliveryDate.value, page: 1, pageSize: 100 })
    booked.value = Object.fromEntries(page.items.map((order) => [order.vehicleCode, order.no]))
  }

  /** Back to today, then load vehicles and that day's bookings. */
  async function reset(): Promise<void> {
    deliveryDate.value = todayIso()
    const [list] = await Promise.all([fetchVehicles(), loadBooked()])
    vehicles.value = list
  }

  async function setDate(iso: string): Promise<void> {
    deliveryDate.value = iso
    await loadBooked()
  }

  return { vehicles, booked, deliveryDate, reset, setDate, loadBooked }
}
