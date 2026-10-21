import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Invoices from '../../pages/Invoices';
import { ToastProvider } from '../../context/ToastContext';
import { invoicesApi, customersApi, medicinesApi } from '../../api/client';

vi.mock('../../api/client', () => ({
  invoicesApi: {
    list: vi.fn(),
    generateNumber: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    get: vi.fn(),
  },
  customersApi: { listAll: vi.fn() },
  medicinesApi: { listAll: vi.fn() },
}));

const medicines = [
  {
    _id: 'm0',
    name: 'INSULIN GLARGINE',
    manufacturer: 'Biocon',
    hsn: '300431',
    quantity: 20,
    mrp: 600,
    rate: 450,
    ptr: 500,
    gstRate: 0,
    batches: [{ batchNumber: 'INS-1', quantity: 20, rate: 450, mrp: 600, ptr: 500 }],
  },
  {
    _id: 'm12',
    name: 'ZINC SYRUP',
    manufacturer: 'Sun',
    hsn: '300450',
    quantity: 10,
    mrp: 60,
    rate: 45,
    ptr: 48,
    gstRate: 12,
    batches: [{ batchNumber: 'ZN-1', quantity: 10, rate: 45, mrp: 60, ptr: 48 }],
  },
];

const openInvoiceForm = async (user) => {
  render(
    <MemoryRouter>
      <ToastProvider>
        <Invoices />
      </ToastProvider>
    </MemoryRouter>
  );

  await user.click(await screen.findByRole('button', { name: /New Sale Invoice/i }));
  await screen.findByText(/New Sale Invoice/i, { selector: 'h2, h3' });
};

const firstRow = () => document.querySelector('.invoice-single-line-item');
const gstSelect = (row) => row.querySelector('.input-group-gst select');
const optionValues = (select) =>
  Array.from(select.options).map((option) => option.value);

const pickMedicine = async (user, search) => {
  await user.click(firstRow().querySelector('.searchable-select-trigger'));
  await user.type(screen.getByPlaceholderText(/Search medicine/i), `${search}{Enter}`);
};

const totalRow = (label) =>
  screen.getByText(label, { selector: '.invoice-total-row span' }).nextElementSibling;

beforeEach(() => {
  invoicesApi.list.mockResolvedValue({
    data: { items: [], pagination: { page: 1, pages: 1, total: 0 } },
  });
  invoicesApi.generateNumber.mockResolvedValue({
    data: { invoiceNumber: 'AH-2026-011' },
  });
  invoicesApi.create.mockResolvedValue({ message: 'Invoice created', data: {} });
  customersApi.listAll.mockResolvedValue([
    { _id: 'c1', name: 'ARNAV', contact: '8294786523' },
  ]);
  medicinesApi.listAll.mockResolvedValue(medicines);
});

describe('GST rate on an invoice line', () => {
  it('offers the current slabs on a new line', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);

    const select = gstSelect(firstRow());
    expect(optionValues(select)).toEqual(['0', '5', '18', '40']);
    expect(select).toHaveValue('5');
  });

  it('keeps a 0% medicine at 0% and adds no tax', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);
    await pickMedicine(user, 'insulin');

    expect(gstSelect(firstRow())).toHaveValue('0');

    const qty = firstRow().querySelector('.input-group-qty input');
    await user.clear(qty);
    await user.type(qty, '2');

    // 2 x 500 PTR = 1000 taxable, no CGST/SGST.
    expect(totalRow('Subtotal')).toHaveTextContent('₹1,000.00');
    expect(totalRow('CGST')).toHaveTextContent('₹0.00');
    expect(totalRow('SGST')).toHaveTextContent('₹0.00');
    expect(totalRow('Grand Total')).toHaveTextContent('₹1,000.00');
  });

  it('saves a 0% line with gstRate 0, not the 5% default', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);

    await user.click(screen.getByText('Select customer...'));
    await user.type(screen.getByPlaceholderText(/Search customer/i), 'arnav{Enter}');
    await pickMedicine(user, 'insulin');
    const qty = firstRow().querySelector('.input-group-qty input');
    await user.clear(qty);
    await user.type(qty, '2');

    await user.click(screen.getByRole('button', { name: 'Create Invoice' }));

    await waitFor(() => expect(invoicesApi.create).toHaveBeenCalledTimes(1));
    const payload = invoicesApi.create.mock.calls[0][0];
    expect(payload.items[0].gstRate).toBe(0);
  });

  it('keeps an old 12% rate selectable for a medicine still stored at 12%', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);
    await pickMedicine(user, 'zinc');

    const select = gstSelect(firstRow());
    expect(select).toHaveValue('12');
    expect(optionValues(select)).toEqual(['0', '5', '12', '18', '40']);
    expect(select.querySelector('option[value="12"]')).toHaveTextContent('12% (old slab)');

    // Moving off 12% and back is still possible while the medicine is at 12%.
    await user.selectOptions(select, '18');
    await user.selectOptions(gstSelect(firstRow()), '12');
    expect(gstSelect(firstRow())).toHaveValue('12');
  });
});
