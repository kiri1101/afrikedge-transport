import { INestApplication } from '@nestjs/common';
import { as, createTestApp } from './support/app';
import { resetDb } from './support/db';
import { orders } from './support/orders';

type Line = { no: string; status: string };

/**
 * One database reset for the file (a reset costs ~10 s): tests run in order and share state.
 * TO-0003 (VH-01, 1 360 / 1 500 kg) and TO-0004 (VH-04, empty, 5 000 kg) are the two drafts.
 */
describe('transport order lines', () => {
  let app: INestApplication;
  let api: ReturnType<typeof orders>;

  beforeAll(async () => {
    resetDb();
    app = await createTestApp();
    api = orders(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('R5 refuses going over capacity with the excess', async () => {
    const res = await api.add('TO-0003', await api.versionOf('TO-0003'), [
      'SO-1008',
    ]);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CAPACITY_EXCEEDED');
    expect(res.body.params).toMatchObject({
      capacityKg: 1500,
      currentKg: 1360,
      requestedKg: 430,
      excessKg: 290,
    });
  });

  it('R5 accepts a load exactly equal to capacity', async () => {
    const res = await api.add('TO-0003', await api.versionOf('TO-0003'), [
      'SO-1031',
    ]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalWeightKg: 1500, remainingKg: 0 });
  });

  it('R4/R6 adds three orders at once and plans them', async () => {
    const before = await api.versionOf('TO-0004');

    const res = await api.add('TO-0004', before, [
      'SO-1008',
      'SO-1011',
      'SO-1013',
    ]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ lineCount: 3, totalWeightKg: 835.5 });
    expect(res.body.lines.every((l: Line) => l.status === 'PLANNED')).toBe(
      true,
    );
    expect(res.headers.etag).not.toBe(`"${before}"`);
    const toPlan = await as(app, 'diane').get('/sales-orders/to-plan');
    expect(toPlan.body.total).toBe(29); // 33 - SO-1031 - the three above
  });

  it('adds weights with cents exactly', async () => {
    const res = await api.add('TO-0004', await api.versionOf('TO-0004'), [
      'SO-1027',
      'SO-1040',
    ]);

    expect(res.body.totalWeightKg).toBe(980.75); // 835.50 + 60.25 + 85.00
  });

  it('normalises lower-case and padded numbers', async () => {
    const res = await api.add('TO-0004', await api.versionOf('TO-0004'), [
      ' so-1017 ',
    ]);

    expect(res.status).toBe(200);
    expect(res.body.lines.map((l: Line) => l.no)).toContain('SO-1017');
  });

  it('R3 refuses an order already planned', async () => {
    const res = await api.add('TO-0004', await api.versionOf('TO-0004'), [
      'SO-1003',
    ]);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SALES_ORDER_NOT_PLANNABLE');
  });

  it('refuses an unknown order with 422', async () => {
    const res = await api.add('TO-0004', await api.versionOf('TO-0004'), [
      'SO-9999',
    ]);

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SALES_ORDER_UNKNOWN');
  });

  it('R4 adds nothing when one order of the batch is refused', async () => {
    const before = (await api.detail('TO-0004')).body;

    const res = await api.add('TO-0004', before.version, [
      'SO-1024',
      'SO-1003',
    ]);

    expect(res.status).toBe(409);
    const after = (await api.detail('TO-0004')).body;
    expect(after.lineCount).toBe(before.lineCount);
    expect(after.version).toBe(before.version);
    const toPlan = await as(app, 'diane').get(
      '/sales-orders/to-plan?city=Douala',
    );
    expect(toPlan.body.items.map((o: Line) => o.no)).toContain('SO-1024');
  });

  it('refuses duplicates with 400', async () => {
    const res = await api.add('TO-0004', await api.versionOf('TO-0004'), [
      'SO-1024',
      'so-1024',
    ]);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('DUPLICATE_SALES_ORDERS');
  });

  it('R7 refuses changes to a validated order', async () => {
    const res = await api.add('TO-0002', await api.versionOf('TO-0002'), [
      'SO-1024',
    ]);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_NOT_DRAFT');
  });

  it('requires If-Match with 428', async () => {
    const res = await as(app, 'diane')
      .post('/transport-orders/TO-0004/lines')
      .send({ salesOrderNos: ['SO-1024'] });

    expect(res.status).toBe(428);
    expect(res.body.code).toBe('VERSION_REQUIRED');
  });

  it('refuses a stale version with 412', async () => {
    const v1 = await api.versionOf('TO-0004');
    expect((await api.add('TO-0004', v1, ['SO-1024'])).status).toBe(200);

    const res = await api.add('TO-0004', v1, ['SO-1030']);

    expect(res.status).toBe(412);
    expect(res.body.code).toBe('STALE_VERSION');
  });

  it('returns 404 for TO-9999', async () => {
    const res = await api.add('TO-9999', '0000000000000000', ['SO-1030']);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('TRANSPORT_ORDER_NOT_FOUND');
  });

  it('R6 removes a line and puts the order back to plan', async () => {
    const before = (await api.detail('TO-0003')).body;

    const res = await api.remove('TO-0003', before.version, 'SO-1006');

    expect(res.status).toBe(200);
    expect(res.body.lineCount).toBe(before.lineCount - 1);
    const toPlan = await as(app, 'diane').get(
      '/sales-orders/to-plan?city=Bafoussam',
    );
    expect(toPlan.body.items.map((o: Line) => o.no)).toContain('SO-1006');
  });

  it('returns 404 LINE_NOT_FOUND for an order not in the transport order', async () => {
    const res = await api.remove(
      'TO-0003',
      await api.versionOf('TO-0003'),
      'SO-1008',
    );

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LINE_NOT_FOUND');
  });

  it('R7 refuses removing from a validated order', async () => {
    const res = await api.remove(
      'TO-0002',
      await api.versionOf('TO-0002'),
      'SO-1003',
    );

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_NOT_DRAFT');
  });
});
