import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({
    // E2E_LOG=1 shows server errors (500s) while debugging a test.
    logger: process.env.E2E_LOG ? ['error'] : false,
  });
  configureApp(app);
  await app.init();
  return app;
}

export type TestUser = 'diane' | 'eric';

/** Supertest requests sent as one of the two hard-coded users. */
export function as(app: INestApplication, user: TestUser) {
  const server = app.getHttpServer();
  return {
    get: (url: string) => request(server).get(url).set('X-User-Id', user),
    post: (url: string) => request(server).post(url).set('X-User-Id', user),
    delete: (url: string) => request(server).delete(url).set('X-User-Id', user),
  };
}
