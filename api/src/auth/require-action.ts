import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DomainError } from '../common/domain-error';
import { Action, can } from '../domain/permissions';
import { RequestWithUser } from './user.guard';

const ACTION_KEY = 'requiredAction';

/** Refuses with 403 when the current user's role may not perform `action` (same table as allowedActions). */
@Injectable()
export class ActionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get<Action | undefined>(
      ACTION_KEY,
      context.getHandler(),
    );
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;
    if (action && user && !can(user.role, action))
      throw new DomainError('FORBIDDEN_ROLE', { action });
    return true;
  }
}

export const RequireAction = (action: Action) =>
  applyDecorators(SetMetadata(ACTION_KEY, action), UseGuards(ActionGuard));
