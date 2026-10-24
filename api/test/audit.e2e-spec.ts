import { INestApplication } from '@nestjs/common';
import { AuditEntry, MemorySink } from '../src/audit/audit-log';
import { as, createTestApp } from './support/app';
import { resetDb } from './support/db';
import { orders } from './support/orders';

describe('audit log', () => {
  let app: INestApplication;
  const sink = new MemorySink();
  const forRequest = (id: string): AuditEntry[] =>
    sink.entries.filter((entry) => entry.requestId === id);

  beforeAll(async () => {
    resetDb();
    app = await createTestApp({ auditSink: sink });
  });

  afterAll(async () => {
    await app.close();
  });

  it('traces a change from request to SQL to response under one request id', async () => {
    const version = await orders(app).versionOf('TO-0004');

    const res = await as(app, 'diane')
      .post('/transport-orders/TO-0004/lines')
      .set('If-Match', `"${version}"`)
      .set('X-Request-Id', 'audit-test-1')
      .send({ salesOrderNos: ['SO-1008'] });

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('audit-test-1');
    const entries = forRequest('audit-test-1');
    expect(entries[0]).toMatchObject({
      type: 'http.request',
      user: 'diane',
      method: 'POST',
      path: '/transport-orders/TO-0004/lines',
      body: { salesOrderNos: ['SO-1008'] },
    });
    expect(entries.at(-1)).toMatchObject({
      type: 'http.response',
      status: 200,
    });
    expect(
      entries.filter((e) => e.type === 'db.transaction').map((e) => e.action),
    ).toEqual(['begin', 'commit']);
    const writes = entries
      .filter((e) => e.type === 'db.write')
      .map((e) => String(e.sql));
    expect(
      writes.some((sql) => sql.startsWith('UPDATE [Transport Order] SET')),
    ).toBe(true);
    expect(
      writes.some((sql) =>
        sql.startsWith('INSERT INTO [Transport Order Line]'),
      ),
    ).toBe(true);
    expect(entries.some((e) => e.type === 'db.read')).toBe(true);
  });

  it('records a refusal as an error with its code and a rolled-back transaction', async () => {
    const version = await orders(app).versionOf('TO-0003');

    const res = await as(app, 'diane')
      .post('/transport-orders/TO-0003/lines')
      .set('If-Match', `"${version}"`)
      .set('X-Request-Id', 'audit-test-2')
      .send({ salesOrderNos: ['SO-1035'] });

    expect(res.status).toBe(409);
    const entries = forRequest('audit-test-2');
    expect(entries.find((e) => e.type === 'http.error')).toMatchObject({
      status: 409,
      code: 'CAPACITY_EXCEEDED',
    });
    expect(
      entries.filter((e) => e.type === 'db.transaction').map((e) => e.action),
    ).toEqual(['begin', 'rollback']);
    expect(entries.at(-1)).toMatchObject({
      type: 'http.response',
      status: 409,
    });
  });

  it('generates a request id when none is sent', async () => {
    const res = await as(app, 'diane').get('/vehicles');

    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(forRequest(id).some((e) => e.type === 'db.read')).toBe(true);
  });

  it('ignores an unsafe incoming request id', async () => {
    // Node refuses to send a newline in a header; spaces and markup are the realistic case.
    const res = await as(app, 'diane')
      .get('/vehicles')
      .set('X-Request-Id', 'bad id <script>');

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('never logs response bodies', async () => {
    await as(app, 'diane').get('/transport-orders/TO-0003');

    expect(JSON.stringify(sink.entries)).not.toContain(
      'Agro Distribution Ouest',
    );
  });
});
