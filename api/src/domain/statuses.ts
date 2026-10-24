export type SalesOrderStatus = 'TO_PLAN' | 'PLANNED' | 'IN_DELIVERY';
export type TransportOrderStatus = 'DRAFT' | 'VALIDATED' | 'DEPARTED';

/** ERP tinyint codes, indexed by position. */
const SALES_ORDER_STATUSES: readonly SalesOrderStatus[] = [
  'TO_PLAN',
  'PLANNED',
  'IN_DELIVERY',
];
const TRANSPORT_ORDER_STATUSES: readonly TransportOrderStatus[] = [
  'DRAFT',
  'VALIDATED',
  'DEPARTED',
];

export const SALES_ORDER_STATUS_CODE: Record<SalesOrderStatus, number> = {
  TO_PLAN: 0,
  PLANNED: 1,
  IN_DELIVERY: 2,
};
export const TRANSPORT_ORDER_STATUS_CODE: Record<TransportOrderStatus, number> =
  { DRAFT: 0, VALIDATED: 1, DEPARTED: 2 };

export function salesOrderStatusFromCode(code: number): SalesOrderStatus {
  const status = SALES_ORDER_STATUSES[code];
  if (!status) throw new Error(`Unknown sales order status code: ${code}`);
  return status;
}

export function transportOrderStatusFromCode(
  code: number,
): TransportOrderStatus {
  const status = TRANSPORT_ORDER_STATUSES[code];
  if (!status) throw new Error(`Unknown transport order status code: ${code}`);
  return status;
}
