import { can } from './permissions';

describe('can', () => {
  it('lets only a logistics manager validate', () => {
    expect(can('DISPATCHER', 'VALIDATE')).toBe(false);
    expect(can('LOGISTICS_MANAGER', 'VALIDATE')).toBe(true);
  });

  it('lets both roles create, edit lines and depart', () => {
    for (const action of [
      'CREATE',
      'ADD_LINES',
      'REMOVE_LINES',
      'DEPART',
    ] as const) {
      expect(can('DISPATCHER', action)).toBe(true);
      expect(can('LOGISTICS_MANAGER', action)).toBe(true);
    }
  });
});
