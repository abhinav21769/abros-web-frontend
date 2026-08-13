import { describe, it, expect } from 'vitest';
import {
  getLineUnits,
  getAvailableStockForLine,
  getMedicineStockLabel,
} from '../../utils/invoiceStock';

describe('Invoice Stock Utilities', () => {
  it('getLineUnits calculates quantity plus free', () => {
    expect(getLineUnits({ quantity: 10, free: 2 })).toBe(12);
    expect(getLineUnits({ quantity: 5 })).toBe(5);
    expect(getLineUnits(null)).toBe(0);
  });

  it('getAvailableStockForLine returns available stock for medicine and batch', () => {
    const medicines = [
      {
        _id: 'med-1',
        name: 'Paracetamol',
        quantity: 50,
        batches: [
          { batchNumber: 'B1', quantity: 30 },
          { batchNumber: 'B2', quantity: 20 },
        ],
      },
    ];

    const formItems = [
      { medicine: 'med-1', batchNumber: 'B1', quantity: 10 },
      { medicine: 'med-1', batchNumber: 'B1', quantity: 5 },
    ];

    // For line 0: total B1 is 30, minus line 1 (5 units) = 25 available
    const availableForLine0 = getAvailableStockForLine({
      formItems,
      medicines,
      lineIndex: 0,
    });
    expect(availableForLine0).toBe(25);

    // For line 1: total B1 is 30, minus line 0 (10 units) = 20 available
    const availableForLine1 = getAvailableStockForLine({
      formItems,
      medicines,
      lineIndex: 1,
    });
    expect(availableForLine1).toBe(20);
  });

  it('getMedicineStockLabel formats stock label', () => {
    const medicine = { _id: 'med-1', quantity: 100 };
    const label = getMedicineStockLabel(medicine, [medicine], [], null, 'pending');
    expect(label).toBe('Stock: 100');
  });
});
