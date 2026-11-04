import { describe, it, expect } from 'vitest';
import {
  DEFAULT_GST_RATE,
  GST_RATE_OPTIONS,
  getGstRateOptions,
  isLegacyGstRate,
  normalizeGstRate,
  normalizeDiscount,
  calculateLineAmount,
  getLineTaxableAmount,
  getLineTotalWithGst,
  calculateInvoiceTax,
} from '../../utils/invoiceTax';

describe('Invoice Tax Utilities', () => {
  it('normalizeGstRate returns valid rate or default 5', () => {
    expect(normalizeGstRate(undefined)).toBe(5);
    expect(normalizeGstRate(-2)).toBe(5);
    expect(normalizeGstRate(0)).toBe(0);
    expect(normalizeGstRate('18')).toBe(18);
  });

  it('normalizeDiscount restricts between 0 and 100', () => {
    expect(normalizeDiscount(-5)).toBe(0);
    expect(normalizeDiscount(120)).toBe(100);
    expect(normalizeDiscount(10)).toBe(10);
  });

  it('calculateLineAmount computes gross minus discount', () => {
    // 10 qty * 100 rate = 1000 - 10% = 900
    expect(calculateLineAmount(10, 100, 10)).toBe(900);
    expect(calculateLineAmount(5, 20, 0)).toBe(100);
  });

  it('getLineTotalWithGst calculates amount with 5% GST', () => {
    // 100 taxable + 2.5% CGST (2.5) + 2.5% SGST (2.5) = 105
    const item = { quantity: 1, rate: 100, discount: 0, gstRate: 5 };
    expect(getLineTotalWithGst(item)).toBe(105);
  });

  it('calculateInvoiceTax aggregates subtotals, taxes, and grand total', () => {
    const items = [
      { quantity: 10, rate: 100, discount: 0, gstRate: 12 }, // 1000 taxable, 60 cgst, 60 sgst = 1120
      { quantity: 2, rate: 200, discount: 10, gstRate: 18 },  // 360 taxable, 32.4 cgst, 32.4 sgst = 424.8
    ];

    const result = calculateInvoiceTax(items);

    expect(result.subtotal).toBe(1360);
    expect(result.cgst).toBe(92.4);
    expect(result.sgst).toBe(92.4);
    expect(result.grandTotal).toBe(1545); // 1360 + 92.4 + 92.4 = 1544.8 rounded to 1545
  });

  it('offers the post-22-Sep-2025 slabs: 0, 5, 18 and 40', () => {
    expect(GST_RATE_OPTIONS).toEqual([0, 5, 18, 40]);
    expect(DEFAULT_GST_RATE).toBe(5);
  });

  it('normalizeGstRate keeps 0 and only defaults empty input', () => {
    expect(normalizeGstRate('0')).toBe(0);
    expect(normalizeGstRate(40)).toBe(40);
    expect(normalizeGstRate(null)).toBe(DEFAULT_GST_RATE);
    expect(normalizeGstRate('')).toBe(DEFAULT_GST_RATE);
    expect(normalizeGstRate('  ')).toBe(DEFAULT_GST_RATE);
    expect(normalizeGstRate('invalid')).toBe(DEFAULT_GST_RATE);
  });

  it('getGstRateOptions keeps an old stored rate selectable', () => {
    expect(getGstRateOptions()).toEqual([0, 5, 18, 40]);
    expect(getGstRateOptions('5')).toEqual([0, 5, 18, 40]);
    expect(getGstRateOptions('12')).toEqual([0, 5, 12, 18, 40]);
    expect(getGstRateOptions(28, '12', undefined, '')).toEqual([0, 5, 12, 18, 28, 40]);
    expect(getGstRateOptions(null, 'abc', -1)).toEqual([0, 5, 18, 40]);
  });

  it('isLegacyGstRate flags rates outside the current slabs', () => {
    expect(isLegacyGstRate(12)).toBe(true);
    expect(isLegacyGstRate('28')).toBe(true);
    expect(isLegacyGstRate(0)).toBe(false);
    expect(isLegacyGstRate('40')).toBe(false);
  });

  it('a 0% line adds no tax, alongside a 40% line', () => {
    // Same figures as the backend buildInvoiceTotals test, to keep both sides identical.
    const items = [
      { quantity: 10, rate: 50, discount: 0, gstRate: 0 }, // 500, no tax
      { quantity: 1, rate: 1000, discount: 10, gstRate: 40 }, // 900, 180 + 180
    ];

    expect(getLineTotalWithGst(items[0])).toBe(500);
    expect(getLineTotalWithGst(items[1])).toBe(1260);

    const result = calculateInvoiceTax(items);
    expect(result.subtotal).toBe(1400);
    expect(result.cgst).toBe(180);
    expect(result.sgst).toBe(180);
    expect(result.grandTotal).toBe(1760);
    expect(result.roundOff).toBe(0);
  });

  it('a 0% line stays 0% when the rate comes from the medicine', () => {
    const item = { quantity: 2, rate: 100, medicine: { gstRate: 0 } };
    expect(getLineTaxableAmount(item)).toBe(200);
    expect(getLineTotalWithGst(item)).toBe(200);
  });

  it('an all-0% invoice totals to its rounded subtotal', () => {
    const result = calculateInvoiceTax([{ quantity: 3, rate: 33.33, discount: 0, gstRate: '0' }]);
    expect(result.subtotal).toBe(99.99);
    expect(result.cgst).toBe(0);
    expect(result.grandTotal).toBe(100);
    expect(result.roundOff).toBe(0.01);
  });
});
