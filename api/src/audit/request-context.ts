import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContext = { requestId: string; user: string | null };

/** Carries the request id and user through every async call of a request, down to SQL. */
export const requestContext = new AsyncLocalStorage<RequestContext>();
