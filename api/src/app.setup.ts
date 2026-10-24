import {
  INestApplication,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

/** Shared by main.ts and the e2e tests, so both run the same pipes, filter, CORS and docs. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new DomainError('VALIDATION_FAILED', { errors: flatten(errors) }),
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  // ETag and Location must be exposed, or browser code cannot read them.
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
    exposedHeaders: ['ETag', 'Location'],
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
