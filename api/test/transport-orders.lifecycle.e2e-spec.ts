import { INestApplication } from '@nestjs/common';
import { as, createTestApp } from './support/app';
import { resetDb } from './support/db';
import { orders } from './support/orders';

type Line = { status: string };

/** One reset for the file; tests run in order. Seed: TO-0003 Draft (2 lines), TO-0004 Draft (empty), TO-0002 Validated, TO-0001 Departed. */
describe('transport order lifecycle', () => {
  let app: INestApplication;
  let diane: ReturnType<typeof orders>;
  let eric: ReturnType<typeof orders>;

  beforeAll(async () => {
    resetDb();
    app = await createTestApp();
    diane = orders(app, 'diane');
    eric = orders(app, 'eric');
  });

  afterAll(async () => {
    await app.close();
  });

  it('R8 forbids a dispatcher to validate with 403', async () => {
    const res = await diane.validate(
      'TO-0003',
      await diane.versionOf('TO-0003'),
    );

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('requires If-Match on validate', async () => {
    const res = await as(app, 'eric').post(
      '/transport-orders/TO-0003/validate',
    );

    expect(res.status).toBe(428);
    expect(res.body.code).toBe('VERSION_REQUIRED');
  });

  it('R8 refuses validating an empty order', async () => {
    const res = await eric.validate('TO-0004', await eric.versionOf('TO-0004'));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_EMPTY');
  });

  it('R8 validates a draft with lines', async () => {
    const res = await eric.validate('TO-0003', await eric.versionOf('TO-0003'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'VALIDATED',
      validatedBy: 'eric',
      allowedActions: ['DEPART'],
    });
  });

  it('R8 makes a validated order read-only', async () => {
    const res = await diane.add('TO-0003', await diane.versionOf('TO-0003'), [
      'SO-1031',
    ]);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORDER_NOT_DRAFT');
  });

  it('refuses validating twice', async () => {
    const res = await eric.validate('TO-0002', await eric.versionOf('TO-0002'));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('requires If-Match on depart', async () => {
    const res = await as(app, 'diane').post('/transport-orders/TO-0002/depart');

    expect(res.status).toBe(428);
  });

  it('R9 departs a validated order and ships its orders', async () => {
    const res = await diane.depart('TO-0002', await diane.versionOf('TO-0002'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'DEPARTED', allowedActions: [] });
    expect(res.body.lines).toHaveLength(3);
    expect(res.body.lines.every((l: Line) => l.status === 'IN_DELIVERY')).toBe(
      true,
    );
  });

  it('R9 refuses departing a draft or a departed order', async () => {
    const draft = await diane.depart(
      'TO-0004',
      await diane.versionOf('TO-0004'),
    );
    const departed = await diane.depart(
      'TO-0001',
      await diane.versionOf('TO-0001'),
    );

    expect(draft.status).toBe(409);
    expect(draft.body.code).toBe('INVALID_TRANSITION');
    expect(departed.status).toBe(409);
    expect(departed.body.code).toBe('INVALID_TRANSITION');
  });
});
