import { describe, it, expect } from 'vitest';
import { formatAmount, formatCurrency, formatInteger, formatPercentage } from '../../frontend/src/utils/formatters';

describe('formatters utility unit tests', () => {
  it('formats integer monetary values with default 2 decimal places and ₹ prefix', () => {
    expect(formatCurrency(1000)).toMatch(/₹\s*1,000\.00/);
  });

  it('formats decimal monetary values with proper rounding and locale grouping', () => {
    expect(formatCurrency(1250.5)).toMatch(/₹\s*1,250\.50/);
    expect(formatCurrency('1250000.75')).toMatch(/₹\s*12,50,000\.75/);
  });

  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toMatch(/₹\s*0\.00/);
    expect(formatCurrency(0, { maximumFractionDigits: 0 })).toMatch(/₹\s*0/);
  });

  it('formats negative numbers without crashing', () => {
    const res = formatCurrency(-500);
    expect(res).toContain('500.00');
    expect(res).toContain('₹');
  });

  it('safely handles missing or empty values with fallback', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency('')).toBe('—');
    expect(formatCurrency(null, { fallback: 'N/A' })).toBe('N/A');
  });

  it('safely handles non-numeric strings and NaN without throwing', () => {
    expect(formatCurrency('invalid_number')).toBe('—');
    expect(formatCurrency(NaN)).toBe('—');
    expect(formatCurrency(Infinity)).toBe('—');
  });

  it('does not throw RangeError when maximumFractionDigits: 0 is specified', () => {
    expect(() => formatCurrency(45000, { maximumFractionDigits: 0 })).not.toThrow();
    expect(formatCurrency(45000, { maximumFractionDigits: 0 })).toMatch(/₹\s*45,000/);
  });

  it('clamps minimumFractionDigits when minimum > maximum', () => {
    expect(() => formatCurrency(123.456, { minimumFractionDigits: 4, maximumFractionDigits: 2 })).not.toThrow();
    const formatted = formatCurrency(123.456, { minimumFractionDigits: 4, maximumFractionDigits: 2 });
    expect(formatted).toMatch(/₹\s*123\.46/);
  });

  it('handles negative or out of bounds fraction digits gracefully', () => {
    expect(() => formatCurrency(123, { minimumFractionDigits: -1, maximumFractionDigits: -5 })).not.toThrow();
    expect(() => formatCurrency(123, { minimumFractionDigits: 50, maximumFractionDigits: 100 })).not.toThrow();
  });

  it('formats integers correctly', () => {
    expect(formatInteger(15)).toBe('15');
    expect(formatInteger(null)).toBe('0');
  });

  it('formats percentages correctly', () => {
    expect(formatPercentage(12.5)).toBe('12.5%');
    expect(formatPercentage(null)).toBe('—');
  });
});
