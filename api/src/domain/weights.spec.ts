import { toHundredths, toKg } from './weights';

describe('weights', () => {
  it('converts kg to whole hundredths', () => {
    expect(toHundredths(145.5)).toBe(14550);
    expect(toHundredths(60.25)).toBe(6025);
  });

  it('absorbs floating-point noise', () => {
    expect(toHundredths(0.1 + 0.2)).toBe(30);
  });

  it('converts hundredths back to kg', () => {
    expect(toKg(14550)).toBe(145.5);
  });
});
