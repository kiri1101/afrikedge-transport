import { nextTransportOrderNo } from './order-number';

describe('nextTransportOrderNo', () => {
  it('starts at TO-0001', () => {
    expect(nextTransportOrderNo(null)).toBe('TO-0001');
  });

  it('increments and keeps four digits', () => {
    expect(nextTransportOrderNo('TO-0004')).toBe('TO-0005');
    expect(nextTransportOrderNo('TO-0099')).toBe('TO-0100');
  });

  it('widens past TO-9999', () => {
    expect(nextTransportOrderNo('TO-9999')).toBe('TO-10000');
  });
});
