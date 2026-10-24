import { http } from './http'
import type { Vehicle } from './types'

export async function fetchVehicles(): Promise<Vehicle[]> {
  return (await http<Vehicle[]>('/vehicles')).data
}
