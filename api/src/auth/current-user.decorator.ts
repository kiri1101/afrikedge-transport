import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithUser } from './user.guard';
import { CurrentUser as User } from './users';

/** The user resolved by UserGuard from X-User-Id. */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<RequestWithUser>().user!,
);
