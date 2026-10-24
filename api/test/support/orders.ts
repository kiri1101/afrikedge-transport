import { INestApplication } from '@nestjs/common';
import { as, TestUser } from './app';

/** Helpers for transport-order mutations, always sending If-Match the way the front does. */
export function orders(app: INestApplication, user: TestUser = 'diane') {
  const client = as(app, user);
  return {
    detail: (no: string) => client.get(`/transport-orders/${no}`),
    versionOf: async (no: string): Promise<string> =>
      (await client.get(`/transport-orders/${no}`)).body.version as string,
    add: (no: string, version: string, salesOrderNos: string[]) =>
      client
        .post(`/transport-orders/${no}/lines`)
        .set('If-Match', `"${version}"`)
        .send({ salesOrderNos }),
    remove: (no: string, version: string, salesOrderNo: string) =>
      client
        .delete(`/transport-orders/${no}/lines/${salesOrderNo}`)
        .set('If-Match', `"${version}"`),
    validate: (no: string, version: string) =>
      client
        .post(`/transport-orders/${no}/validate`)
        .set('If-Match', `"${version}"`),
    depart: (no: string, version: string) =>
      client
        .post(`/transport-orders/${no}/depart`)
        .set('If-Match', `"${version}"`),
  };
}
