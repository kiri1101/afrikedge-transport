import { describe, expect, it } from 'vitest'
import { formatKg, loadLevel, toHundredths } from './weights'

describe('formatKg', () => {
  it('formats in French with two decimals', () => {
    expect(formatKg(1360, 'fr').replace(/\s/g, ' ')).toBe('1 360,00 kg')
  })

  it('formats in English with two decimals', () => {
    expect(formatKg(1360, 'en')).toBe('1,360.00 kg')
  })
})

describe('loadLevel', () => {
  it('is ok up to 85 %', () => {
    expect(loadLevel(1275, 1500)).toBe('ok')
  })

  it('warns above 85 %', () => {
    expect(loadLevel(1360, 1500)).toBe('warn')
  })

  it('is over above 100 %', () => {
    expect(loadLevel(2195.5, 1500)).toBe('over')
  })
})

describe('toHundredths', () => {
  it('matches the API rule', () => {
    expect(toHundredths(0.1 + 0.2)).toBe(30)
  })
})
