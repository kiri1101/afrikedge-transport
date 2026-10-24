import { DomainError, ErrorCode } from '../common/domain-error';
import { Role } from '../auth/users';
import {
  allowedActions,
  assertCanAddLines,
  assertCanDepart,
  assertCanRemoveLine,
  assertCanValidate,
  assertDeliveryDateNotPast,
  assertVehicleFree,
  assertVehicleUsable,
  Candidate,
  OrderState,
} from './rules';
import { TransportOrderStatus } from './statuses';

/** TO-0003 from the seed data: VH-01, 1 360 kg loaded out of 1 500 kg. */
const draft = (over: Partial<OrderState> = {}): OrderState => ({
  no: 'TO-0003',
  status: 'DRAFT',
  capacity: 150000,
  load: 136000,
  lineCount: 2,
  ...over,
});

const toPlan = (no: string, weight: number): Candidate => ({
  no,
  status: 'TO_PLAN',
  weight,
});

function expectCode(
  fn: () => void,
  code: ErrorCode,
  params?: Record<string, unknown>,
): void {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(DomainError);
  expect((thrown as DomainError).code).toBe(code);
  if (params) expect((thrown as DomainError).params).toMatchObject(params);
}

describe('capacity (R5)', () => {
  it('accepts a load exactly equal to capacity', () => {
    expect(() =>
      assertCanAddLines(draft(), ['SO-1031'], [toPlan('SO-1031', 14000)]),
    ).not.toThrow();
  });

  it('refuses one hundredth of a kg over capacity', () => {
    expectCode(
      () => assertCanAddLines(draft(), ['SO-X'], [toPlan('SO-X', 14001)]),
      'CAPACITY_EXCEEDED',
      {
        transportOrderNo: 'TO-0003',
        capacityKg: 1500,
        currentKg: 1360,
        requestedKg: 140.01,
        excessKg: 0.01,
      },
    );
  });

  it('sums several orders before comparing', () => {
    const three = [
      toPlan('SO-1008', 43000),
      toPlan('SO-1011', 26000),
      toPlan('SO-1013', 14550),
    ];
    const nos = three.map((c) => c.no);

    expect(() =>
      assertCanAddLines(draft({ load: 0, capacity: 500000 }), nos, three),
    ).not.toThrow();
    expectCode(
      () => assertCanAddLines(draft({ load: 0, capacity: 80000 }), nos, three),
      'CAPACITY_EXCEEDED',
      {
        requestedKg: 835.5,
        excessKg: 35.5,
      },
    );
  });
});

describe('assignment (R3, R7)', () => {
  it('refuses an order that is not TO_PLAN', () => {
    expectCode(
      () =>
        assertCanAddLines(
          draft(),
          ['SO-1003'],
          [{ no: 'SO-1003', status: 'PLANNED', weight: 110000 }],
        ),
      'SALES_ORDER_NOT_PLANNABLE',
      { salesOrderNos: ['SO-1003'] },
    );
  });

  it('refuses unknown numbers', () => {
    expectCode(
      () => assertCanAddLines(draft(), ['SO-9999'], []),
      'SALES_ORDER_UNKNOWN',
      {
        salesOrderNos: ['SO-9999'],
      },
    );
  });

  it('refuses duplicates in one request', () => {
    expectCode(
      () =>
        assertCanAddLines(
          draft(),
          ['SO-1008', 'SO-1008'],
          [toPlan('SO-1008', 43000)],
        ),
      'DUPLICATE_SALES_ORDERS',
      { salesOrderNos: ['SO-1008'] },
    );
  });

  it('refuses adding to a non-draft order', () => {
    expectCode(
      () =>
        assertCanAddLines(
          draft({ status: 'VALIDATED' }),
          ['SO-1031'],
          [toPlan('SO-1031', 14000)],
        ),
      'ORDER_NOT_DRAFT',
    );
  });

  it('refuses removing from a non-draft order', () => {
    expectCode(
      () =>
        assertCanRemoveLine(draft({ status: 'VALIDATED' }), true, 'SO-1006'),
      'ORDER_NOT_DRAFT',
    );
  });

  it('refuses removing a line the order does not have', () => {
    expectCode(
      () => assertCanRemoveLine(draft(), false, 'SO-1008'),
      'LINE_NOT_FOUND',
      {
        transportOrderNo: 'TO-0003',
        salesOrderNo: 'SO-1008',
      },
    );
  });

  it('allows removing an existing line from a draft', () => {
    expect(() => assertCanRemoveLine(draft(), true, 'SO-1006')).not.toThrow();
  });
});

describe('status changes (R8, R9)', () => {
  const run = (action: 'validate' | 'depart', order: OrderState) =>
    action === 'validate' ? assertCanValidate(order) : assertCanDepart(order);

  it.each<
    [TransportOrderStatus, number, 'validate' | 'depart', ErrorCode | null]
  >([
    ['DRAFT', 2, 'validate', null],
    ['DRAFT', 0, 'validate', 'ORDER_EMPTY'],
    ['VALIDATED', 2, 'validate', 'INVALID_TRANSITION'],
    ['DEPARTED', 2, 'validate', 'INVALID_TRANSITION'],
    ['VALIDATED', 2, 'depart', null],
    ['DRAFT', 2, 'depart', 'INVALID_TRANSITION'],
    ['DEPARTED', 2, 'depart', 'INVALID_TRANSITION'],
  ])(
    '%s with %i lines → %s gives %s',
    (status, lineCount, action, expected) => {
      const order = draft({ status, lineCount });
      if (expected === null) {
        expect(() => run(action, order)).not.toThrow();
      } else {
        expectCode(() => run(action, order), expected);
      }
    },
  );
});

describe('creation (R1, R2)', () => {
  it('refuses a past date and accepts today', () => {
    expectCode(
      () => assertDeliveryDateNotPast('2026-10-23', '2026-10-24'),
      'DELIVERY_DATE_IN_PAST',
      {
        deliveryDate: '2026-10-23',
        today: '2026-10-24',
      },
    );
    expect(() =>
      assertDeliveryDateNotPast('2026-10-24', '2026-10-24'),
    ).not.toThrow();
  });

  it('refuses an unknown or inactive vehicle', () => {
    expectCode(() => assertVehicleUsable(null, 'VH-99'), 'VEHICLE_UNKNOWN', {
      vehicleCode: 'VH-99',
    });
    expectCode(
      () => assertVehicleUsable({ active: false }, 'VH-07'),
      'VEHICLE_INACTIVE',
      { vehicleCode: 'VH-07' },
    );
    expect(() => assertVehicleUsable({ active: true }, 'VH-01')).not.toThrow();
  });

  it('refuses a vehicle already booked that day', () => {
    expectCode(
      () => assertVehicleFree('TO-0003', 'VH-01', '2026-10-25'),
      'VEHICLE_ALREADY_BOOKED',
      {
        transportOrderNo: 'TO-0003',
      },
    );
    expect(() => assertVehicleFree(null, 'VH-05', '2026-10-25')).not.toThrow();
  });
});

describe('allowedActions', () => {
  it.each<[TransportOrderStatus, number, Role, string[]]>([
    ['DRAFT', 2, 'DISPATCHER', ['ADD_LINES', 'REMOVE_LINES']],
    [
      'DRAFT',
      2,
      'LOGISTICS_MANAGER',
      ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE'],
    ],
    ['DRAFT', 0, 'LOGISTICS_MANAGER', ['ADD_LINES']],
    ['VALIDATED', 3, 'DISPATCHER', ['DEPART']],
    ['DEPARTED', 2, 'LOGISTICS_MANAGER', []],
  ])('%s with %i lines for %s → %j', (status, lineCount, role, expected) => {
    expect(allowedActions({ status, lineCount }, role)).toEqual(expected);
  });
});
