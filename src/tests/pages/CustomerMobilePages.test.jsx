import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Customers from '../../pages/Customers';
import { ToastProvider } from '../../context/ToastContext';
import { customersApi } from '../../api/client';

vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    customersApi: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
  };
});

const customer = { _id: 'c1', name: 'Apollo Pharmacy', address: '12 MG Road', contact: '', gstin: '', dlNo: '' };

const setMobile = (matches) => {
  window.matchMedia.mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const renderAt = (path = '/customers') =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/customers/*" element={<Customers />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

describe('Customers form on mobile vs desktop', () => {
  beforeEach(() => {
    customersApi.list.mockResolvedValue({
      data: {
        items: [customer],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 10 },
      },
    });
    customersApi.get.mockResolvedValue({ data: customer });
  });

  it('keeps the dialog on desktop without changing the URL', async () => {
    setMobile(false);
    const user = userEvent.setup();
    renderAt();

    await user.click(await screen.findByRole('button', { name: /Add Customer/ }));

    expect(await screen.findByRole('button', { name: 'Close modal' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/customers');
    expect(screen.getByTestId('location').textContent).toBe('/customers');
  });

  it('opens a full page at /customers/new on mobile and returns to the list on back', async () => {
    setMobile(true);
    const user = userEvent.setup();
    renderAt();

    await user.click(await screen.findByRole('button', { name: /Add Customer/ }));

    expect(await screen.findByRole('region', { name: 'Add Customer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/customers/new');

    await user.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/customers'));
    expect(screen.queryByRole('region', { name: 'Add Customer' })).not.toBeInTheDocument();
  });

  it('loads the customer for a deep-linked edit page', async () => {
    setMobile(true);
    renderAt('/customers/c1/edit');

    expect(await screen.findByRole('region', { name: 'Edit Customer' })).toBeInTheDocument();
    expect(customersApi.get).toHaveBeenCalledWith('c1');
    await waitFor(() =>
      expect(screen.getByDisplayValue('Apollo Pharmacy')).toBeInTheDocument()
    );
  });

  it('saves from the page and goes back to the list', async () => {
    setMobile(true);
    customersApi.update.mockResolvedValue({ message: 'Customer updated' });
    const user = userEvent.setup();
    renderAt('/customers/c1/edit');

    await screen.findByDisplayValue('Apollo Pharmacy');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(customersApi.update).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/customers'));
  });
});
