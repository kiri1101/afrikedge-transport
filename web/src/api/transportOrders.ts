import { http } from './http'
import type { Page, TransportOrderDetail, TransportOrderStatus, TransportOrderSummary } from './types'

const orderPath = (no: string) => `/transport-orders/${encodeURIComponent(no)}`

export async function fetchTransportOrders(query: {
  status: TransportOrderStatus | null
  deliveryDate: string | null
  page: number
  pageSize: number
}): Promise<Page<TransportOrderSummary>> {
  return (await http<Page<TransportOrderSummary>>('/transport-orders', { query })).data
}

export async function fetchTransportOrder(no: string): Promise<TransportOrderDetail> {
  return (await http<TransportOrderDetail>(orderPath(no))).data
}

export async function createTransportOrder(body: {
  vehicleCode: string
  deliveryDate: string
}): Promise<TransportOrderDetail> {
  return (await http<TransportOrderDetail>('/transport-orders', { method: 'POST', body })).data
}

export async function addLines(no: string, version: string, salesOrderNos: string[]): Promise<TransportOrderDetail> {
  return (
    await http<TransportOrderDetail>(`${orderPath(no)}/lines`, {
      method: 'POST',
      body: { salesOrderNos },
      ifMatch: version,
    })
  ).data
}

export async function removeLine(no: string, version: string, salesOrderNo: string): Promise<TransportOrderDetail> {
  return (
    await http<TransportOrderDetail>(`${orderPath(no)}/lines/${encodeURIComponent(salesOrderNo)}`, {
      method: 'DELETE',
      ifMatch: version,
    })
  ).data
}

export async function validateOrder(no: string, version: string): Promise<TransportOrderDetail> {
  return (await http<TransportOrderDetail>(`${orderPath(no)}/validate`, { method: 'POST', ifMatch: version })).data
}

export async function departOrder(no: string, version: string): Promise<TransportOrderDetail> {
  return (await http<TransportOrderDetail>(`${orderPath(no)}/depart`, { method: 'POST', ifMatch: version })).data
}
