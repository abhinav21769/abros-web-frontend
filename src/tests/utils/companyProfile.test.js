import { describe, it, expect } from 'vitest';
import {
  companyToForm,
  emptyCompanyForm,
  formToPayload,
  COMPANY_SECTIONS,
} from '../../utils/companyProfile';
import { validateCompanyForm } from '../../utils/formValidation';

describe('companyToForm', () => {
  it('fills a blank form when there is no company yet', () => {
    expect(companyToForm(null)).toEqual(emptyCompanyForm());
  });

  it('always leaves two drug licence rows to type into', () => {
    expect(companyToForm({ name: 'X', dlNumbers: [] }).dlNumbers).toEqual(['', '']);
    expect(companyToForm({ name: 'X', dlNumbers: ['DL-1'] }).dlNumbers).toEqual(['DL-1', '']);
    expect(companyToForm({ name: 'X', dlNumbers: ['DL-1', 'DL-2'] }).dlNumbers).toEqual([
      'DL-1',
      'DL-2',
    ]);
  });

  it('keeps the bank block whole even when the company has none', () => {
    expect(companyToForm({ name: 'X' }).bank).toEqual({
      name: '',
      ifsc: '',
      accountNumber: '',
    });
  });
});

describe('formToPayload', () => {
  it('trims, upper-cases and drops blank licence rows', () => {
    const form = {
      ...emptyCompanyForm(),
      name: '  Fresh Pharma  ',
      gstin: ' 06aaaaa0000a1z5 ',
      dlNumbers: [' DL-1 ', '   '],
      bank: { name: ' PNB ', ifsc: ' punb0120310 ', accountNumber: ' 10401132 ' },
      invoicePrefix: ' fp ',
    };

    expect(formToPayload(form)).toMatchObject({
      name: 'Fresh Pharma',
      gstin: '06AAAAA0000A1Z5',
      dlNumbers: ['DL-1'],
      bank: { name: 'PNB', ifsc: 'PUNB0120310', accountNumber: '10401132' },
      invoicePrefix: 'FP',
    });
  });

  it('falls back to the default prefixes when they are left blank', () => {
    const payload = formToPayload(emptyCompanyForm());
    expect(payload.invoicePrefix).toBe('INV');
    expect(payload.purchasePrefix).toBe('PO');
  });
});

describe('validateCompanyForm', () => {
  const withName = (extra) => ({ ...emptyCompanyForm(), name: 'Fresh Pharma', ...extra });

  it('requires only the company name', () => {
    expect(validateCompanyForm(withName())).toEqual({});
    expect(validateCompanyForm(emptyCompanyForm()).name).toMatch(/required/i);
  });

  it('rejects details that would print wrong on a tax invoice', () => {
    expect(validateCompanyForm(withName({ gstin: 'NOPE' })).gstin).toBeTruthy();
    expect(validateCompanyForm(withName({ pincode: '123' })).pincode).toBeTruthy();
    expect(validateCompanyForm(withName({ phone: '12345' })).phone).toBeTruthy();
    expect(validateCompanyForm(withName({ upiVpa: 'not-a-vpa' })).upiVpa).toBeTruthy();
    expect(validateCompanyForm(withName({ invoicePrefix: 'TOO-LONG!' })).invoicePrefix).toBeTruthy();
    expect(
      validateCompanyForm(withName({ bank: { name: '', ifsc: 'BAD', accountNumber: '' } }))[
        'bank.ifsc'
      ],
    ).toBeTruthy();
  });

  it('accepts a well-formed profile in full', () => {
    const errors = validateCompanyForm(
      withName({
        gstin: '06AAAAA0000A1Z5',
        pincode: '134003',
        phone: '9876543210',
        email: 'shop@example.com',
        upiVpa: 'fresh@paytm',
        invoicePrefix: 'FP',
        purchasePrefix: 'PO',
        bank: { name: 'PNB', ifsc: 'PUNB0120310', accountNumber: '10401132' },
      }),
    );

    expect(errors).toEqual({});
  });
});

describe('COMPANY_SECTIONS', () => {
  it('covers the wizard steps in order', () => {
    expect(COMPANY_SECTIONS.map((s) => s.id)).toEqual([
      'identity',
      'address',
      'tax',
      'payment',
    ]);
  });
});
