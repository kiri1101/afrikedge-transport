// Shapes of the API responses (specification §7.3).

export type Role = 'DISPATCHER' | 'LOGISTICS_MANAGER'
export type SalesOrderStatus = 'TO_PLAN' | 'PLANNED' | 'IN_DELIVERY'
export type TransportOrderStatus = 'DRAFT' | 'VALIDATED' | 'DEPARTED'
export type TransportOrderAction = 'ADD_LINES' | 'REMOVE_LINES' | 'VALIDATE' | 'DEPART'

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number }

export type SalesOrder = {
  no: string
  customerNo: string
  customerName: string
  deliveryCity: string
  totalWeightKg: number
  status: SalesOrderStatus
}

export type Vehicle = { code: string; plateNo: string; capacityKg: number; active: boolean }

export type TransportOrderSummary = {
  no: string
  version: string
  status: TransportOrderStatus
  deliveryDate: string
  vehicleCode: string
  plateNo: string
  capacityKg: number
  lineCount: number
  totalWeightKg: number
  createdBy: string
  validatedBy: string | null
}

export type TransportOrderDetail = TransportOrderSummary & {
  remainingKg: number
  lines: SalesOrder[]
  allowedActions: TransportOrderAction[]
}
