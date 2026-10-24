import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { as, createTestApp } from './support/app';
import { resetDb } from './support/db';

describe('GET /vehicles', () => {
  let app: INestApplication;

  beforeAll(async () => {
    resetDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists the 9 active vehicles in camelCase', async () => {
    const res = await as(app, 'diane').get('/vehicles');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(9);
    expect(res.body[0]).toEqual({
      code: 'VH-01',
      plateNo: 'LT-482-AB',
      capacityKg: 1500,
      active: true,
    });
    expect(res.body.map((v: { code: string }) => v.code)).not.toContain(
      'VH-07',
    );
  });

  it('rejects a request without X-User-Id with 401 problem+json', async () => {
    const res = await request(app.getHttpServer()).get('/vehicles');

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
    expect(res.body).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('rejects an unknown user with 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/vehicles')
      .set('X-User-Id', 'bob');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});
