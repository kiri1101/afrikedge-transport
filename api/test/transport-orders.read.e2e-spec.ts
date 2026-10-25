import { INestApplication } from '@nestjs/common';
import { as, createTestApp, TestUser } from './support/app';
import { resetDb } from './support/db';

type Summary = { no: string };

describe('transport orders (read)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    resetDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists orders by date desc then number desc', async () => {
    const res = await as(app, 'diane').get('/transport-orders');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items.map((o: Summary) => o.no)).toEqual([
      'TO-0004',
      'TO-0003',
      'TO-0002',
      'TO-0001',
    ]);
  });

  it('filters by status', async () => {
    const res = await as(app, 'diane').get('/transport-orders?status=DRAFT');

    expect(res.body.items.map((o: Summary) => o.no)).toEqual([
      'TO-0004',
      'TO-0003',
    ]);
  });

  it('filters by delivery date', async () => {
    const all = await as(app, 'diane').get('/transport-orders');
    const tomorrow = all.body.items.find(
      (o: Summary) => o.no === 'TO-0003',
    ).deliveryDate;

    const res = await as(app, 'diane').get(
      `/transport-orders?deliveryDate=${tomorrow}`,
    );

    expect(res.body.items.map((o: Summary) => o.no)).toEqual([
      'TO-0003',
      'TO-0002',
    ]);
  });

  it('returns load figures and a 16-hex version', async () => {
    const res = await as(app, 'diane').get('/transport-orders?status=DRAFT');
    const to3 = res.body.items.find((o: Summary) => o.no === 'TO-0003');

    expect(to3).toMatchObject({
      status: 'DRAFT',
      vehicleCode: 'VH-01',
      plateNo: 'LT-482-AB',
      capacityKg: 1500,
      lineCount: 2,
      totalWeightKg: 1360,
      createdBy: 'diane',
      validatedBy: null,
    });
    expect(to3.version).toMatch(/^[0-9A-F]{16}$/);
    expect(to3.deliveryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns the detail with lines, remaining capacity and ETag', async () => {
    const res = await as(app, 'diane').get('/transport-orders/TO-0003');

    expect(res.status).toBe(200);
    expect(res.body.lines.map((l: Summary) => l.no)).toEqual([
      'SO-1006',
      'SO-1007',
    ]);
    expect(res.body.lines[0]).toMatchObject({
      customerName: 'Agro Distribution Ouest',
      status: 'PLANNED',
    });
    expect(res.body.remainingKg).toBe(140);
    expect(res.headers.etag).toBe(`"${res.body.version}"`);
  });

  it.each<[TestUser, string, string[]]>([
    ['diane', 'TO-0003', ['ADD_LINES', 'REMOVE_LINES']],
    ['eric', 'TO-0003', ['ADD_LINES', 'REMOVE_LINES', 'VALIDATE']],
    ['eric', 'TO-0004', ['ADD_LINES']],
    ['diane', 'TO-0002', ['DEPART']],
    ['eric', 'TO-0001', []],
  ])('allowedActions for %s on %s', async (user, no, expected) => {
    const res = await as(app, user).get(`/transport-orders/${no}`);

    expect(res.body.allowedActions).toEqual(expected);
  });

  it('rejects a non-calendar date filter with 400', async () => {
    const res = await as(app, 'diane').get(
      '/transport-orders?deliveryDate=2026-W43-1',
    );

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it("serves each user their own view even when a browser revalidates with another user's ETag", async () => {
    // A browser caches eric's detail, then revalidates as diane with If-None-Match: same order version.
    const asEric = await as(app, 'eric').get('/transport-orders/TO-0003');

    const asDiane = await as(app, 'diane')
      .get('/transport-orders/TO-0003')
      .set('If-None-Match', asEric.headers.etag);

    expect(asDiane.status).toBe(200);
    expect(asDiane.body.allowedActions).toEqual(['ADD_LINES', 'REMOVE_LINES']);
    expect(asDiane.headers['cache-control']).toBe('no-store');
  });

  it('returns 404 TRANSPORT_ORDER_NOT_FOUND for TO-9999', async () => {
    const res = await as(app, 'diane').get('/transport-orders/TO-9999');

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TRANSPORT_ORDER_NOT_FOUND');
  });
});
