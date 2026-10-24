const pad = (n: number) => String(n).padStart(2, '0')

/** YYYY-MM-DD of the local calendar day. Never toISOString(): it converts to UTC first. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

/** YYYY-MM-DD → DD/MM/YYYY, by string, so no time zone can shift the day. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

/** YYYY-MM-DD → local Date at midnight, for date pickers. */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year!, month! - 1, day)
}
