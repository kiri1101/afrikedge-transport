import { ZonedClock } from './clock';

describe('ZonedClock', () => {
  it('returns the Douala date, already tomorrow at 23:30 UTC', () => {
    const clock = new ZonedClock(
      'Africa/Douala',
      () => new Date('2026-10-24T23:30:00Z'),
    );
    expect(clock.today()).toBe('2026-10-25');
  });

  it('returns YYYY-MM-DD', () => {
    const clock = new ZonedClock(
      'Africa/Douala',
      () => new Date('2026-01-05T10:00:00Z'),
    );
    expect(clock.today()).toBe('2026-01-05');
  });
});
