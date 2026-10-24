export type Role = 'DISPATCHER' | 'LOGISTICS_MANAGER';

export type CurrentUser = { id: string; role: Role };

/** The brief allows hard-coding the two users. */
export const USERS: Readonly<Record<string, CurrentUser>> = {
  diane: { id: 'diane', role: 'DISPATCHER' },
  eric: { id: 'eric', role: 'LOGISTICS_MANAGER' },
};

export function findUser(id: string | undefined): CurrentUser | undefined {
  // Object.hasOwn keeps inherited keys such as "constructor" from passing as users.
  return id !== undefined && Object.hasOwn(USERS, id) ? USERS[id] : undefined;
}
