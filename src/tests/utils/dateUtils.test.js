import { describe, it, expect } from 'vitest';
import {
  getCalendarParts,
  getInvoiceMonthNumber,
  toDateInputValue,
  toInvoiceDatePayload,
  formatCalendarDate,
} from '../../utils/dateUtils';

describe('Date Utilities', () => {
  it('getCalendarParts extracts IST year, month, day', () => {
    const parts = getCalendarParts('2026-08-15T12:00:00Z');
    expect(parts.year).toBe('2026');
    expect(parts.month).toBe('08');
    expect(parts.day).toBe('15');
  });

  it('getInvoiceMonthNumber returns numeric month', () => {
    expect(getInvoiceMonthNumber('2026-04-10')).toBe(4);
    expect(getInvoiceMonthNumber(null)).toBeNull();
  });

  it('toDateInputValue formats to YYYY-MM-DD input format', () => {
    expect(toDateInputValue('2026-11-20T00:00:00Z')).toBe('2026-11-20');
  });

  it('toInvoiceDatePayload extracts date string', () => {
    expect(toInvoiceDatePayload('2026-05-18T10:30:00.000Z')).toBe('2026-05-18');
    expect(toInvoiceDatePayload(null)).toBeUndefined();
  });

  it('formatCalendarDate formats to human Indian date format', () => {
    const formatted = formatCalendarDate('2026-01-26T00:00:00Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Jan');
  });
});
