import { Role } from '../auth/users';
import { DomainError } from '../common/domain-error';
import { Action, can } from './permissions';
import { SalesOrderStatus, TransportOrderStatus } from './statuses';
import { KgHundredths, toKg } from './weights';

/** What the rules need to know about a transport order, loaded under lock. */
export type OrderState = {
  no: string;
  status: TransportOrderStatus;
  capacity: KgHundredths;
  load: KgHundredths;
  lineCount: number;
};

/** A sales order requested for a transport order. */
export type Candidate = {
  no: string;
  status: SalesOrderStatus;
  weight: KgHundredths;
};

export type OrderAction = Exclude<Action, 'CREATE'>;

// R1: dates are YYYY-MM-DD strings, so string order is date order.
export function assertDeliveryDateNotPast(
  deliveryDate: string,
  today: string,
): void {
  if (deliveryDate < today)
    throw new DomainError('DELIVERY_DATE_IN_PAST', { deliveryDate, today });
}

// R1
export function assertVehicleUsable(
  vehicle: { active: boolean } | null,
  vehicleCode: string,
): void {
  if (!vehicle) throw new DomainError('VEHICLE_UNKNOWN', { vehicleCode });
  if (!vehicle.active)
    throw new DomainError('VEHICLE_INACTIVE', { vehicleCode });
}

// R2
export function assertVehicleFree(
  bookedOrderNo: string | null,
  vehicleCode: string,
  deliveryDate: string,
): void {
  if (bookedOrderNo) {
    throw new DomainError('VEHICLE_ALREADY_BOOKED', {
      vehicleCode,
      deliveryDate,
      transportOrderNo: bookedOrderNo,
    });
  }
}

// R7
function assertDraft(order: OrderState): void {
  if (order.status !== 'DRAFT') {
    throw new DomainError('ORDER_NOT_DRAFT', {
      transportOrderNo: order.no,
      status: order.status,
    });
  }
}

// R3, R4, R5, R7 — checked in this order: status, duplicates, unknown, plannable, capacity.
export function assertCanAddLines(
  order: OrderState,
  requestedNos: string[],
  found: Candidate[],
): void {
  assertDraft(order);

  const duplicates = [
    ...new Set(requestedNos.filter((no, i) => requestedNos.indexOf(no) !== i)),
  ];
  if (duplicates.length > 0)
    throw new DomainError('DUPLICATE_SALES_ORDERS', {
      salesOrderNos: duplicates,
    });

  const foundNos = new Set(found.map((candidate) => candidate.no));
  const unknown = requestedNos.filter((no) => !foundNos.has(no));
  if (unknown.length > 0)
    throw new DomainError('SALES_ORDER_UNKNOWN', { salesOrderNos: unknown });

  const notPlannable = found
    .filter((candidate) => candidate.status !== 'TO_PLAN')
    .map((candidate) => candidate.no);
  if (notPlannable.length > 0)
    throw new DomainError('SALES_ORDER_NOT_PLANNABLE', {
      salesOrderNos: notPlannable,
    });

  const requested = found.reduce((sum, candidate) => sum + candidate.weight, 0);
  const excess = order.load + requested - order.capacity;
  if (excess > 0) {
    throw new DomainError('CAPACITY_EXCEEDED', {
      transportOrderNo: order.no,
      capacityKg: toKg(order.capacity),
      currentKg: toKg(order.load),
      requestedKg: toKg(requested),
      excessKg: toKg(excess),
    });
  }
}

// R6, R7
export function assertCanRemoveLine(
  order: OrderState,
  lineExists: boolean,
  salesOrderNo: string,
): void {
  assertDraft(order);
  if (!lineExists)
    throw new DomainError('LINE_NOT_FOUND', {
      transportOrderNo: order.no,
      salesOrderNo,
    });
}

// R8 (the role is checked by the action guard before the transaction)
export function assertCanValidate(order: OrderState): void {
  if (order.status !== 'DRAFT') {
    throw new DomainError('INVALID_TRANSITION', {
      transportOrderNo: order.no,
      from: order.status,
      to: 'VALIDATED',
    });
  }
  if (order.lineCount === 0)
    throw new DomainError('ORDER_EMPTY', { transportOrderNo: order.no });
}

// R9
export function assertCanDepart(order: OrderState): void {
  if (order.status !== 'VALIDATED') {
    throw new DomainError('INVALID_TRANSITION', {
      transportOrderNo: order.no,
      from: order.status,
      to: 'DEPARTED',
    });
  }
}

/** The actions the screen may offer: same rules as the guards above, filtered by role. */
export function allowedActions(
  order: Pick<OrderState, 'status' | 'lineCount'>,
  role: Role,
): OrderAction[] {
  const byStatus: OrderAction[] =
    order.status === 'DRAFT'
      ? order.lineCount > 0
        ? ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE']
        : ['ADD_LINES']
      : order.status === 'VALIDATED'
        ? ['DEPART']
        : [];
  return byStatus.filter((action) => can(role, action));
}
