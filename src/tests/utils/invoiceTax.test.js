import { describe, it, expect } from 'vitest';
import {
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
});
