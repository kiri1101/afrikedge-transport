import { INestApplication } from '@nestjs/common';
import { as, createTestApp } from './support/app';
import { resetDb } from './support/db';

describe('sales orders to plan', () => {
  let app: INestApplication;

  beforeAll(async () => {
    resetDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the 33 orders to plan, 20 per page, sorted by number, camelCase only', async () => {
    const res = await as(app, 'diane').get('/sales-orders/to-plan');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 33 });
    expect(res.body.items).toHaveLength(20);
    expect(res.body.items[0]).toEqual({
      no: 'SO-1008',
      customerNo: 'C0001',
      customerName: 'Quincaillerie Ndokoti',
      deliveryCity: 'Douala',
      totalWeightKg: 430,
      status: 'TO_PLAN',
    });
  });

  it('filters by city and paginates', async () => {
    const all = await as(app, 'diane').get('/sales-orders/to-plan?city=Douala');
    const page2 = await as(app, 'diane').get(
      '/sales-orders/to-plan?city=Douala&page=2&pageSize=10',
    );

    expect(all.body.total).toBe(11);
    expect(page2.body.items.map((o: { no: string }) => o.no)).toEqual([
      'SO-1039',
    ]);
  });

  it('filters an accented city', async () => {
    const res = await as(app, 'diane').get(
      `/sales-orders/to-plan?city=${encodeURIComponent('Yaoundé')}`,
    );

    expect(res.body.total).toBe(7);
  });

  it('returns an empty page past the end', async () => {
    const res = await as(app, 'diane').get('/sales-orders/to-plan?page=99');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 33 });
  });

  it('rejects pageSize 0 with 400 VALIDATION_FAILED and field errors', async () => {
    const res = await as(app, 'diane').get('/sales-orders/to-plan?pageSize=0');

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors[0].field).toBe('pageSize');
  });

  it('lists cities having orders to plan', async () => {
    const res = await as(app, 'diane').get('/sales-orders/to-plan/cities');

    expect(res.body).toEqual([
      'Bafoussam',
      'Douala',
      'Edéa',
      'Kribi',
      'Limbé',
      'Yaoundé',
    ]);
  });
});
