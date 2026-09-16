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

// These tests are about keyboard behaviour in the billing form, so the signed-in
// company is stubbed rather than driven through a real login.
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: { id: 'u1', username: 'tester', role: 'admin' },
    company: { id: 'c1', name: 'Test Pharma' },
    isAdmin: true,
    isViewer: false,
    needsOnboarding: false,
  }),
}));

const medicines = [
  {
    _id: 'm1',
    name: 'PARACETAMOL 500',
    manufacturer: 'Cipla',
    hsn: '3004',
    quantity: 40,
    mrp: 30,
    rate: 20,
    ptr: 22,
    gstRate: 5,
    batches: [{ batchNumber: 'B-1', quantity: 40, rate: 20, mrp: 30, ptr: 22 }],
  },
  {
    _id: 'm2',
    name: 'PARACETAMOL SYRUP',
    manufacturer: 'Sun',
    hsn: '3004',
    quantity: 10,
    mrp: 60,
    rate: 45,
    ptr: 48,
    gstRate: 12,
    batches: [{ batchNumber: 'B-2', quantity: 10, rate: 45, mrp: 60, ptr: 48 }],
  },
  {
    _id: 'm3',
    name: 'AZITHROMYCIN 250',
    manufacturer: 'Alkem',
    hsn: '3005',
    quantity: 25,
    mrp: 120,
    rate: 90,
    ptr: 95,
    gstRate: 5,
    batches: [{ batchNumber: 'B-3', quantity: 25, rate: 90, mrp: 120, ptr: 95 }],
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

const lineRows = () =>
  document.querySelectorAll('.invoice-single-line-item');

const medicineTrigger = (row) =>
  row.querySelector('.searchable-select-trigger');

// The line's labels are plain text, not bound to their inputs, so fields are
// reached by column.
const qtyInput = (row) => row.querySelector('.input-group-qty input');

beforeEach(() => {
  invoicesApi.list.mockResolvedValue({
    data: { items: [], pagination: { page: 1, pages: 1, total: 0 } },
  });
  invoicesApi.generateNumber.mockResolvedValue({
    data: { invoiceNumber: 'AH-2026-011' },
  });
  customersApi.listAll.mockResolvedValue([
    { _id: 'c1', name: 'ARNAV', contact: '8294786523' },
  ]);
  medicinesApi.listAll.mockResolvedValue(medicines);
});

describe('medicine picker', () => {
  it('filters and picks the top match on Enter', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);

    const row = lineRows()[0];
    await user.click(medicineTrigger(row));
    await user.type(
      screen.getByPlaceholderText(/Search medicine/i),
      'azithro{Enter}'
    );

    expect(medicineTrigger(lineRows()[0])).toHaveTextContent('AZITHROMYCIN 250');
  });

  it('matches on manufacturer as well as name', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);

    await user.click(medicineTrigger(lineRows()[0]));
    await user.type(screen.getByPlaceholderText(/Search medicine/i), 'sun');

    const options = document.querySelectorAll('.searchable-select-option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('PARACETAMOL SYRUP');
    expect(options[0]).toHaveClass('is-active');
  });

  it('moves the highlight with the arrow keys', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);

    await user.click(medicineTrigger(lineRows()[0]));
    await user.type(
      screen.getByPlaceholderText(/Search medicine/i),
      'paracetamol{ArrowDown}{Enter}'
    );

    expect(medicineTrigger(lineRows()[0])).toHaveTextContent(
      'PARACETAMOL SYRUP'
    );
  });
});

describe('opening the next line item', () => {
  const pickFirstMedicine = async (user) => {
    await user.click(medicineTrigger(lineRows()[0]));
    await user.type(
      screen.getByPlaceholderText(/Search medicine/i),
      'azithro{Enter}'
    );
  };

  it('starts with a single empty line', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);

    expect(lineRows()).toHaveLength(1);
  });

  it('adds a row on Enter once the line has a medicine', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);
    await pickFirstMedicine(user);

    const qty = qtyInput(lineRows()[0]);
    await user.click(qty);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(lineRows()).toHaveLength(2));
  });

  it('focuses the new row so typing continues', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);
    await pickFirstMedicine(user);

    await user.click(qtyInput(lineRows()[0]));
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(document.activeElement).toBe(medicineTrigger(lineRows()[1]))
    );
  });

  it('adds a row on Tab from the last field of the line', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);
    await pickFirstMedicine(user);

    const fields = lineRows()[0].querySelectorAll(
      '.searchable-select-trigger, select, input:not([tabindex="-1"])'
    );
    await user.click(fields[fields.length - 1]);
    await user.tab();

    await waitFor(() => expect(lineRows()).toHaveLength(2));
  });

  it('leaves Tab alone in the middle of the line', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);
    await pickFirstMedicine(user);

    await user.click(qtyInput(lineRows()[0]));
    await user.tab();

    expect(lineRows()).toHaveLength(1);
  });

  it('does not add a row while the line has no medicine', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);

    await user.click(qtyInput(lineRows()[0]));
    await user.keyboard('{Enter}');

    expect(lineRows()).toHaveLength(1);
  });

  it('only opens a row from the last line', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);
    await pickFirstMedicine(user);

    await user.click(qtyInput(lineRows()[0]));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(lineRows()).toHaveLength(2));

    // Enter on the now-middle line must not insert another.
    await user.click(qtyInput(lineRows()[0]));
    await user.keyboard('{Enter}');
    expect(lineRows()).toHaveLength(2);
  });

  it('does not submit the invoice when Enter opens a row', async () => {
    const user = userEvent.setup();
    await openInvoiceForm(user);
    await pickFirstMedicine(user);

    await user.click(qtyInput(lineRows()[0]));
    await user.keyboard('{Enter}');

    await waitFor(() => expect(lineRows()).toHaveLength(2));
    expect(invoicesApi.create).not.toHaveBeenCalled();
  });
});
