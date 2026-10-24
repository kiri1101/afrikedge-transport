export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'DUPLICATE_SALES_ORDERS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN_ROLE'
  | 'TRANSPORT_ORDER_NOT_FOUND'
  | 'LINE_NOT_FOUND'
  | 'VEHICLE_ALREADY_BOOKED'
  | 'SALES_ORDER_NOT_PLANNABLE'
  | 'CAPACITY_EXCEEDED'
  | 'ORDER_NOT_DRAFT'
  | 'ORDER_EMPTY'
  | 'INVALID_TRANSITION'
  | 'CONCURRENT_UPDATE'
  | 'STALE_VERSION'
  | 'VERSION_REQUIRED'
  | 'VEHICLE_UNKNOWN'
  | 'VEHICLE_INACTIVE'
  | 'DELIVERY_DATE_IN_PAST'
  | 'SALES_ORDER_UNKNOWN'
  | 'INTERNAL_ERROR';

/** A refused business action. Knows nothing about HTTP: the problem-details filter maps the code to a status. */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'DomainError';
  }
}
