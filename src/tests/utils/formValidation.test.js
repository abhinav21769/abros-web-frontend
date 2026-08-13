import { describe, it, expect } from 'vitest';
import {
  hasErrors,
  clearFieldError,
  validateLoginForm,
  validateCustomerForm,
  validateMedicineForm,
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
