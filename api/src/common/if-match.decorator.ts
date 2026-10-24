import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { DomainError } from './domain-error';
import { parseIfMatch } from './if-match';

/** The order version from If-Match; 428 VERSION_REQUIRED when absent or malformed (ADR-0003). */
export const IfMatchVersion = createParamDecorator(
  (_: unknown, context: ExecutionContext): string => {
    const version = parseIfMatch(
      context.switchToHttp().getRequest<Request>().header('if-match'),
    );
    if (!version) throw new DomainError('VERSION_REQUIRED');
    return version;
  },
);
