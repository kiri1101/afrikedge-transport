import { ZonedClock } from '../../src/common/clock';

export function todayInDouala(): string {
  return new ZonedClock('Africa/Douala').today();
}

export function addDays(iso: string, n: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}
