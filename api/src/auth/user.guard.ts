import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { DomainError } from '../common/domain-error';
import { CurrentUser, findUser } from './users';

export type RequestWithUser = Request & { user?: CurrentUser };

/** Global guard: every route needs a known X-User-Id. */
@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = findUser(request.header('x-user-id'));
    if (!user) throw new DomainError('UNAUTHENTICATED');
    request.user = user;
    return true;
  }
}
