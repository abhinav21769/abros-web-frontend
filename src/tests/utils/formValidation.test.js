import { describe, it, expect } from 'vitest';
import {
  hasErrors,
  clearFieldError,
  validateLoginForm,
  validateCustomerForm,
  validateMedicineForm,
  validateBatchForm,
  validateInvoiceForm,
  validatePurchaseForm,
} from '../../utils/formValidation';

describe('Form Validation Utilities', () => {
  describe('hasErrors & clearFieldError', () => {
    it('correctly checks if errors object has keys', () => {
      expect(hasErrors({})).toBe(false);
      expect(hasErrors({ username: 'Required' })).toBe(true);
    });

    it('clears specific field from errors', () => {
      const initial = { username: 'Required', password: 'Too short' };
      const updated = clearFieldError(initial, 'username');
      expect(updated.username).toBeUndefined();
      expect(updated.password).toBe('Too short');
    });
  });

  describe('validateLoginForm', () => {
    it('returns errors for empty fields', () => {
      const errors = validateLoginForm({ username: '', password: '' });
      expect(errors.username).toBeDefined();
      expect(errors.password).toBeDefined();
    });

    it('rejects passwords shorter than 6 characters', () => {
      const errors = validateLoginForm({ username: 'admin', password: '123' });
      expect(errors.password).toBe('Password must be at least 6 characters.');
    });

    it('returns empty errors for valid inputs', () => {
      const errors = validateLoginForm({ username: 'admin', password: 'password123' });
      expect(hasErrors(errors)).toBe(false);
    });
  });

  describe('validateCustomerForm', () => {
    it('validates required name and address', () => {
      const errors = validateCustomerForm({ name: '', address: '' });
      expect(errors.name).toBe('Customer name is required.');
      expect(errors.address).toBe('Address is required.');
    });

    it('validates 10-digit mobile contact number', () => {
      const invalidPhone = validateCustomerForm({
        name: 'Apollo',
        address: 'Delhi 110001',
        contact: '12345',
      });
      expect(invalidPhone.contact).toBe('Contact must be a valid 10-digit mobile number.');

      const validPhone = validateCustomerForm({
        name: 'Apollo',
        address: 'Delhi 110001',
        contact: '9812345678',
      });
      expect(validPhone.contact).toBeUndefined();
    });

    it('validates 15-character GSTIN regex', () => {
      const invalidGstin = validateCustomerForm({
        name: 'Apollo',
        address: 'Delhi 110001',
        gstin: 'INVALIDGST',
      });
      expect(invalidGstin.gstin).toBe('GSTIN must be a valid 15-character GST number.');

      const validGstin = validateCustomerForm({
        name: 'Apollo',
        address: 'Delhi 110001',
        gstin: '07AAAAA0000A1Z5',
      });
      expect(validGstin.gstin).toBeUndefined();
    });
  });

  describe('validateMedicineForm', () => {
    it('validates required fields and rate <= mrp', () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);

      const errors = validateMedicineForm({
        name: 'Paracetamol',
        packagingType: '10 Tabs',
        expiryDate: future.toISOString().split('T')[0],
        mrp: '50',
        rate: '60', // rate > mrp
      });

      expect(errors.rate).toBe('Rate cannot be greater than MRP.');
    });

    it('rejects past expiry dates', () => {
      const past = new Date('2020-01-01');
      const errors = validateMedicineForm({
        name: 'Paracetamol',
        packagingType: '10 Tabs',
        expiryDate: past.toISOString().split('T')[0],
        mrp: '50',
        rate: '40',
      });

      expect(errors.expiryDate).toBe('Expiry date must be in the future.');
    });

    it('allows a past expiry date when editing existing stock', () => {
      const errors = validateMedicineForm(
        {
          name: 'Paracetamol',
          packagingType: '10 Tabs',
          expiryDate: '2020-01-01',
          mrp: '50',
          rate: '40',
        },
        { isEditing: true },
      );

      expect(errors.expiryDate).toBeUndefined();
    });
  });

  describe('validateBatchForm', () => {
    const future = (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1);
      return d.toISOString().split('T')[0];
    })();

    const validForm = {
      batchNumber: 'B-101',
      expiryDate: future,
      mrp: '100',
      rate: '80',
      quantity: '10',
    };

    it('passes for a valid new batch', () => {
      const errors = validateBatchForm(validForm, { existingBatches: [] });
      expect(hasErrors(errors)).toBe(false);
    });

    it('rejects a batch number that duplicates an existing sibling batch', () => {
      const errors = validateBatchForm(validForm, {
        existingBatches: [{ batchNumber: 'b-101' }, { batchNumber: 'B-202' }],
      });
      expect(errors.batchNumber).toBe('This medicine already has a batch with this number.');
    });

    it('excludes the batch being edited from its own duplicate check', () => {
      const errors = validateBatchForm(validForm, {
        existingBatches: [{ batchNumber: 'B-101' }, { batchNumber: 'B-202' }],
        excludeIndex: 0,
      });
      expect(errors.batchNumber).toBeUndefined();
    });

    it('still catches a rename onto a different sibling while editing', () => {
      const errors = validateBatchForm(validForm, {
        existingBatches: [{ batchNumber: 'OLD-NUMBER' }, { batchNumber: 'B-101' }],
        excludeIndex: 0,
      });
      expect(errors.batchNumber).toBe('This medicine already has a batch with this number.');
    });

    it('requires a future expiry date for a new batch', () => {
      const errors = validateBatchForm(
        { ...validForm, expiryDate: '2020-01-01' },
        { existingBatches: [] },
      );
      expect(errors.expiryDate).toBe('Expiry date must be in the future.');
    });

    it('allows a past expiry date when editing an existing (already expired) batch', () => {
      const errors = validateBatchForm(
        { ...validForm, expiryDate: '2020-01-01' },
        { existingBatches: [{ batchNumber: 'B-101' }], excludeIndex: 0 },
      );
      expect(errors.expiryDate).toBeUndefined();
    });

    it('rejects a zero or missing MRP/rate instead of silently accepting it', () => {
      const errors = validateBatchForm(
        { ...validForm, mrp: '', rate: '0' },
        { existingBatches: [] },
      );
      expect(errors.mrp).toBeTruthy();
      expect(errors.rate).toBeTruthy();
    });

    it('rejects rate greater than MRP', () => {
      const errors = validateBatchForm(
        { ...validForm, mrp: '50', rate: '60' },
        { existingBatches: [] },
      );
      expect(errors.rate).toBe('Rate cannot be greater than MRP.');
    });

    it('rejects a negative or fractional quantity', () => {
      const errors = validateBatchForm({ ...validForm, quantity: '-1' }, { existingBatches: [] });
      expect(errors.quantity).toBeTruthy();
    });
  });

  describe('validateInvoiceForm', () => {
    it('requires customer, invoice date, invoice number, and line items', () => {
      const errors = validateInvoiceForm({
        invoiceNumber: '',
        invoiceDate: '',
        customer: '',
        items: [],
      });

      expect(errors.invoiceNumber).toBeDefined();
      expect(errors.invoiceDate).toBeDefined();
      expect(errors.customer).toBe('Customer is required.');
      expect(errors.items).toBe('Add at least one line item.');
    });

    it('bills a sale line at PTR, so PTR is the required price', () => {
      const line = { medicine: 'm1', quantity: '1', ptr: '', rate: '80' };
      const errors = validateInvoiceForm(
        { invoiceNumber: 'AH-2026-001', invoiceDate: '2026-08-28', customer: 'c1', items: [line] },
        { invoiceType: 'sale' },
      );

      expect(errors['items.0.ptr']).toBeDefined();
      expect(errors['items.0.rate']).toBeUndefined();
    });

    it('bills a purchase line at rate, so rate is the required price', () => {
      const line = { medicine: 'm1', quantity: '1', ptr: '76.2', rate: '' };
      const errors = validateInvoiceForm(
        {
          invoiceNumber: 'PO-2026-001',
          invoiceDate: '2026-08-28',
          supplier: 'Acme',
          supplierContact: '9876543210',
          items: [line],
        },
        { invoiceType: 'purchase' },
      );

      expect(errors['items.0.rate']).toBeDefined();
      expect(errors['items.0.ptr']).toBeUndefined();
    });

    it('accepts a sale line priced at PTR with no rate entered', () => {
      const line = { medicine: 'm1', quantity: '1', ptr: '76.2', rate: '' };
      const errors = validateInvoiceForm(
        { invoiceNumber: 'AH-2026-001', invoiceDate: '2026-08-28', customer: 'c1', items: [line] },
        { invoiceType: 'sale' },
      );

      expect(errors['items.0.ptr']).toBeUndefined();
      expect(errors['items.0.rate']).toBeUndefined();
    });
  });

  describe('validatePurchaseForm', () => {
    it('requires purchaseNumber, purchaseDate, and at least one item', () => {
      const errors = validatePurchaseForm({
        purchaseNumber: '',
        purchaseDate: '',
        items: [],
      });

      expect(errors.purchaseNumber).toBeDefined();
      expect(errors.purchaseDate).toBeDefined();
      expect(errors.items).toBe('Add at least one line item.');
    });
  });
});
