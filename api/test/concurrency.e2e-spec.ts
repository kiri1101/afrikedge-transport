import { INestApplication } from '@nestjs/common';
import { createTestApp } from './support/app';
import { resetDb } from './support/db';
import { orders } from './support/orders';

type Line = { no: string };

describe('concurrent changes', () => {
  let app: INestApplication;

  // One reset for both tests: the first leaves TO-0004 at 4 600 or 3 800 kg, room enough for the second.
  beforeAll(async () => {
    resetDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets only one of two simultaneous adds on the same order win', async () => {
    const diane = orders(app, 'diane');
    const eric = orders(app, 'eric');
    const version = await diane.versionOf('TO-0004');

    // 4 600 kg and 3 800 kg each fit in VH-04 (5 000 kg), not together.
    const [a, b] = await Promise.all([
      diane.add('TO-0004', version, ['SO-1018']),
      eric.add('TO-0004', version, ['SO-1036']),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 412]);
    const after = await diane.detail('TO-0004');
    expect(after.body.lineCount).toBe(1);
    expect(after.body.totalWeightKg).toBeLessThanOrEqual(5000);
  });

  it('never puts one sales order in two transport orders', async () => {
    const api = orders(app, 'diane');
    const [v3, v4] = await Promise.all([
      api.versionOf('TO-0003'),
      api.versionOf('TO-0004'),
    ]);

    // SO-1031 (140 kg) fits in both TO-0003 (140 kg left) and TO-0004.
    const [a, b] = await Promise.all([
      api.add('TO-0003', v3, ['SO-1031']),
      api.add('TO-0004', v4, ['SO-1031']),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((a.status === 409 ? a : b).body.code).toBe(
      'SALES_ORDER_NOT_PLANNABLE',
    );
    const [to3, to4] = await Promise.all([
      api.detail('TO-0003'),
      api.detail('TO-0004'),
    ]);
    const holders = [to3, to4].filter((res) =>
      res.body.lines.some((l: Line) => l.no === 'SO-1031'),
    );
    expect(holders).toHaveLength(1);
  });
});
