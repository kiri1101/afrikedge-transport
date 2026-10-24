import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { AuditLog } from './audit-log';
import { RequestContext, requestContext } from './request-context';

/** An incoming X-Request-Id is reused only if it is short and plain; otherwise a UUID is generated. */
const SAFE_REQUEST_ID = /^[\w-]{1,64}$/;
const WITH_BODY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Opens the request context (request id + user) for everything downstream, and audits the
 * request and its response. Response bodies are never logged: they carry customer data.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly audit: AuditLog) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const context: RequestContext = {
      requestId:
        incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID(),
      user: req.header('x-user-id')?.slice(0, 50) ?? null,
    };
    res.setHeader('X-Request-Id', context.requestId);
    const started = performance.now();

    requestContext.run(context, () => {
      const body: unknown = req.body;
      const hasBody =
        WITH_BODY.has(req.method) &&
        typeof body === 'object' &&
        body !== null &&
        Object.keys(body).length > 0;
      this.audit.record('http.request', {
        method: req.method,
        path: req.originalUrl,
        ...(hasBody ? { body } : {}),
      });
      res.on('finish', () =>
        requestContext.run(context, () =>
          this.audit.record('http.response', {
            status: res.statusCode,
            durationMs: Math.round(performance.now() - started),
          }),
        ),
      );
      next();
    });
  }
}
