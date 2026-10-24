import { Role } from '../auth/users';

export type Action =
  'CREATE' | 'ADD_LINES' | 'REMOVE_LINES' | 'VALIDATE' | 'DEPART';

const MANAGER_ONLY: ReadonlySet<Action> = new Set<Action>(['VALIDATE']);

/** A LOGISTICS_MANAGER does everything a DISPATCHER does, plus validation. */
export function can(role: Role, action: Action): boolean {
  return role === 'LOGISTICS_MANAGER' || !MANAGER_ONLY.has(action);
}
