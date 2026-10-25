import { INestApplication } from '@nestjs/common';
import { as, createTestApp } from './support/app';
import { addDays, todayInDouala } from './support/dates';
import { SqlService } from '../src/database/sql.service';
import { resetDb } from './support/db';

describe('POST /transport-orders', () => {
  let app: INestApplication;
  const today = todayInDouala();

  const create = (vehicleCode: string, deliveryDate: string) =>
    as(app, 'diane')
      .post('/transport-orders')
      .send({ vehicleCode, deliveryDate });

  beforeAll(async () => {
    resetDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('R1 creates a DRAFT order TO-0005 for an active vehicle today', async () => {
    const res = await create('VH-05', today);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      no: 'TO-0005',
      status: 'DRAFT',
      vehicleCode: 'VH-05',
      deliveryDate: today,
      createdBy: 'diane',
      validatedBy: null,
      lineCount: 0,
      lines: [],
      allowedActions: ['ADD_LINES'],
    });
    expect(res.headers.location).toBe('/transport-orders/TO-0005');
    expect(res.headers.etag).toBe(`"${res.body.version}"`);
  });

  it('numbers the next order TO-0006', async () => {
    const res = await create('VH-06', today);

    expect(res.status).toBe(201);
    expect(res.body.no).toBe('TO-0006');
  });

  it('R1 refuses an inactive vehicle with 422 VEHICLE_INACTIVE', async () => {
    const res = await create('VH-07', today);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VEHICLE_INACTIVE');
  });

  it('refuses an unknown vehicle with 422 VEHICLE_UNKNOWN', async () => {
    const res = await create('VH-99', today);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VEHICLE_UNKNOWN');
  });

  it('R1 refuses yesterday with 422 DELIVERY_DATE_IN_PAST', async () => {
    const res = await create('VH-08', addDays(today, -1));

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('DELIVERY_DATE_IN_PAST');
  });

  it('R2 refuses a second order for VH-01 tomorrow with 409', async () => {
    const res = await create('VH-01', addDays(today, 1));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('VEHICLE_ALREADY_BOOKED');
    expect(res.body.params.transportOrderNo).toBe('TO-0003');
  });

  it('rejects an impossible date with 400', async () => {
    const res = await create('VH-08', '2026-02-30');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it.each(['2026-W43-1', '2026-10T10'])(
    'rejects the non-calendar ISO date %s with 400',
    async (date) => {
      const res = await create('VH-08', date);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    },
  );

  it('numbers past a non-numeric order number left by the ERP', async () => {
    await app
      .get(SqlService)
      .query(
        "INSERT INTO [Transport Order] ([No_], [Vehicle Code], [Delivery Date], [Status], [Created By]) VALUES ('TO-IMPORT', 'VH-09', '2030-01-01', 0, 'erp')",
      );

    const res = await create('VH-08', today);

    expect(res.status).toBe(201);
    expect(res.body.no).toBe('TO-0007');
  });
});
