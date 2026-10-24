/** Weight in whole hundredths of a kg: decimal(10,2) without floating-point drift. */
export type KgHundredths = number;

export function toHundredths(kg: number): KgHundredths {
  return Math.round(kg * 100);
}

export function toKg(hundredths: KgHundredths): number {
  return hundredths / 100;
}
