import { http } from './http'
import type { Page, SalesOrder } from './types'

export async function fetchToPlan(query: {
  city: string | null
  page: number
  pageSize: number
}): Promise<Page<SalesOrder>> {
  return (await http<Page<SalesOrder>>('/sales-orders/to-plan', { query })).data
}

export async function fetchToPlanCities(): Promise<string[]> {
  return (await http<string[]>('/sales-orders/to-plan/cities')).data
}
