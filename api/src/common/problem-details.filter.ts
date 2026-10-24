import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { DomainError } from './domain-error';
import { ERROR_CATALOG } from './error-catalog';

export type ProblemDetails = {
  type: 'about:blank';
  status: number;
  code: string;
  title: string;
  detail: string;
  params?: Record<string, unknown>;
  errors?: unknown;
};

/** Turns every exception into an RFC 9457 problem+json response with a stable `code`. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = this.toProblem(exception);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblem(exception: unknown): ProblemDetails {
    if (exception instanceof DomainError) {
      const entry = ERROR_CATALOG[exception.code];
      const { errors, ...params } = exception.params;
      return {
        type: 'about:blank',
        status: entry.status,
        code: exception.code,
        title: entry.title,
        detail: entry.detail(exception.params),
        ...(Object.keys(params).length > 0 ? { params } : {}),
        ...(errors !== undefined ? { errors } : {}),
      };
    }
    if (exception instanceof HttpException) {
      return {
        type: 'about:blank',
        status: exception.getStatus(),
        code: 'HTTP_ERROR',
        title: exception.message,
        detail: exception.message,
      };
    }
    this.logger.error(
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : String(exception),
    );
    const entry = ERROR_CATALOG.INTERNAL_ERROR;
    return {
      type: 'about:blank',
      status: entry.status,
      code: 'INTERNAL_ERROR',
      title: entry.title,
      detail: entry.detail({}),
    };
  }
}
