import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import CustomerServices from '../../pages/CustomerServices';
import { ToastProvider } from '../../context/ToastContext';
import { customerServicesApi, customersApi } from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    customerServicesApi: {
      unlock: vi.fn(),
      list: vi.fn(),
      customerNames: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
    customersApi: { ...actual.customersApi, listAll: vi.fn() },
  };
});

const entries = [
  {
    _id: 'e1',
    customerName: 'Apollo Pharmacy',
    amount: 2500,
    date: '2026-10-14T18:30:00.000Z',
    remarks: 'Diwali hamper',
  },
];

const listResponse = (items = entries) => ({
  data: {
    items,
    totalAmount: items.reduce((sum, e) => sum + e.amount, 0),
    pagination: { currentPage: 1, totalPages: 1, totalItems: items.length, itemsPerPage: 10 },
  },
});

const renderPage = () =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/customer-services']}>
        <Link to="/customer-services">Customer Services link</Link>
        <Link to="/other">Other link</Link>
        <Routes>
          <Route path="/customer-services" element={<CustomerServices />} />
          <Route path="/other" element={<div>Other page</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

const unlockWith = async (user, password = 'secret') => {
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: /Unlock/ }));
};

describe('CustomerServices', () => {
  beforeEach(() => {
    customerServicesApi.unlock.mockResolvedValue({ data: { token: 'section-token' } });
    customerServicesApi.list.mockResolvedValue(listResponse());
    customerServicesApi.customerNames.mockResolvedValue({ data: ['Apollo Pharmacy', 'MedPlus'] });
    customersApi.listAll.mockResolvedValue([{ name: 'Wellness Forever' }]);
  });

  it('shows the lock screen and loads nothing before unlocking', () => {
    renderPage();

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(customerServicesApi.list).not.toHaveBeenCalled();
  });

  it('keeps the page locked on a wrong password', async () => {
    customerServicesApi.unlock.mockRejectedValue(new Error('Incorrect Customer Services password.'));
    const user = userEvent.setup();
    renderPage();

    await unlockWith(user, 'wrong');

    expect(await screen.findAllByText('Incorrect Customer Services password.')).not.toHaveLength(0);
    expect(screen.getByLabelText('Password')).toHaveValue('');
    expect(customerServicesApi.list).not.toHaveBeenCalled();
  });

  it('unlocks, then lists entries with the section token', async () => {
    const user = userEvent.setup();
    renderPage();

    await unlockWith(user);

    expect(customerServicesApi.unlock).toHaveBeenCalledWith('secret');
    expect(await screen.findByText('Diwali hamper')).toBeInTheDocument();
    expect(customerServicesApi.list).toHaveBeenCalledWith('section-token', { page: 1, limit: 10 });
    expect(screen.getByRole('option', { name: 'MedPlus' })).toBeInTheDocument();
  });

  it('passes the search and customer filter to the API', async () => {
    const user = userEvent.setup();
    renderPage();
    await unlockWith(user);
    await screen.findByText('Diwali hamper');

    await user.selectOptions(screen.getByLabelText('Filter by customer'), 'MedPlus');
    await waitFor(() =>
      expect(customerServicesApi.list).toHaveBeenLastCalledWith('section-token', {
        page: 1,
        limit: 10,
        customerName: 'MedPlus',
      })
    );

    await user.type(screen.getByPlaceholderText(/Search by customer or remarks/), 'gift');
    await waitFor(() =>
      expect(customerServicesApi.list).toHaveBeenLastCalledWith('section-token', {
        page: 1,
        limit: 10,
        customerName: 'MedPlus',
        search: 'gift',
      })
    );
  });

  it('asks for the password again after leaving and coming back', async () => {
    const user = userEvent.setup();
    renderPage();
    await unlockWith(user);
    await screen.findByText('Diwali hamper');

    await user.click(screen.getByText('Other link'));
    expect(screen.getByText('Other page')).toBeInTheDocument();

    await user.click(screen.getByText('Customer Services link'));
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.queryByText('Diwali hamper')).toBeNull();
  });

  it('locks again when the section token expires', async () => {
    const locked = Object.assign(new Error('Customer Services is locked.'), {
      code: 'SECTION_LOCKED',
    });
    customerServicesApi.list.mockRejectedValue(locked);
    const user = userEvent.setup();
    renderPage();

    await unlockWith(user);

    expect(await screen.findByLabelText('Password')).toBeInTheDocument();
  });

  it('creates an entry with an IST calendar date payload', async () => {
    customerServicesApi.create.mockResolvedValue({ message: 'Entry added successfully.' });
    const user = userEvent.setup();
    renderPage();
    await unlockWith(user);
    await screen.findByText('Diwali hamper');

    await user.click(screen.getByRole('button', { name: /Add Entry/ }));
    await user.type(screen.getByLabelText('Customer Name *'), 'MedPlus');
    await user.type(screen.getByLabelText('Amount (₹) *'), '1200');
    await user.clear(screen.getByLabelText('Date *'));
    await user.type(screen.getByLabelText('Date *'), '2026-10-15');
    await user.type(screen.getByLabelText('Remarks'), 'Sweets box');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(customerServicesApi.create).toHaveBeenCalledWith('section-token', {
        customerName: 'MedPlus',
        amount: 1200,
        date: '2026-10-15',
        remarks: 'Sweets box',
      })
    );
  });

  it('blocks saving without a name or amount', async () => {
    const user = userEvent.setup();
    renderPage();
    await unlockWith(user);
    await screen.findByText('Diwali hamper');

    await user.click(screen.getByRole('button', { name: /Add Entry/ }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Customer name is required.')).toBeInTheDocument();
    expect(screen.getByText('Amount is required.')).toBeInTheDocument();
    expect(customerServicesApi.create).not.toHaveBeenCalled();
  });
});
