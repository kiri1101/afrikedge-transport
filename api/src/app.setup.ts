import {
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { AuditLog } from './audit/audit-log';
import { DomainError } from './common/domain-error';
import { ProblemDetailsFilter } from './common/problem-details.filter';

type FieldError = { field: string; message: string };

function flatten(errors: ValidationError[], parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = error.constraints
      ? [{ field, message: Object.values(error.constraints).join(', ') }]
      : [];
    return [...own, ...flatten(error.children ?? [], field)];
  });
}

/**
 * The API does no HTTP caching. Its ETag is the order version checked by If-Match, but a
 * detail differs per user (allowedActions): answering a revalidation with 304 made the browser
 * show the cached view of whoever opened that version first. Without If-None-Match Express
 * never sends 304, and no-store keeps per-user customer data out of browser caches.
 */
function noHttpCaching(req: Request, res: Response, next: NextFunction): void {
  delete req.headers['if-none-match'];
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/** Shared by main.ts and the e2e tests, so both run the same pipes, filter, CORS and docs. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.use(noHttpCaching);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new DomainError('VALIDATION_FAILED', { errors: flatten(errors) }),
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter(app.get(AuditLog)));
  // ETag, Location and X-Request-Id must be exposed, or browser code cannot read them.
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    exposedHeaders: ['ETag', 'Location', 'X-Request-Id'],
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Planification des transports')
      .setDescription(
        "API du test SEFS1026. Toutes les routes exigent l'en-tête X-User-Id (diane ou eric) ; " +
          "les modifications d'un ordre existant exigent If-Match avec sa version.",
      )
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-User-Id' }, 'user')
      .addSecurityRequirements('user')
      .build(),
  );
  SwaggerModule.setup('docs', app, document);
}
