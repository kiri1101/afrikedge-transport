export type Locale = 'fr' | 'en'
export type LoadLevel = 'ok' | 'warn' | 'over'

/** Same rule as the API: whole hundredths of a kg, so sums never drift. */
export function toHundredths(kg: number): number {
  return Math.round(kg * 100)
}

const formats: Record<Locale, Intl.NumberFormat> = {
  fr: new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  en: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}

export function formatNumber(value: number, locale: Locale): string {
  return formats[locale].format(value)
}

export function formatKg(kg: number, locale: Locale): string {
  return `${formatNumber(kg, locale)} kg`
}

const WARN_PERCENT = 85

/** ok up to 85 % of capacity, warn above, over beyond 100 %. */
export function loadLevel(usedKg: number, capacityKg: number): LoadLevel {
  const used = toHundredths(usedKg)
  const capacity = toHundredths(capacityKg)
  if (used > capacity) return 'over'
  if (used * 100 > capacity * WARN_PERCENT) return 'warn'
  return 'ok'
}
