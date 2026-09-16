import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Customers from '../../pages/Customers';
import Sidebar from '../../components/Layout/Sidebar';
import { ToastProvider } from '../../context/ToastContext';
import { customersApi } from '../../api/client';
import * as AuthContext from '../../context/AuthContext';
import * as ThemeContext from '../../context/ThemeContext';

vi.mock('../../api/client', () => ({
  customersApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

const customer = {
  _id: 'c1',
  name: 'City Medicals',
  address: '12 Market Road',
  contact: '9876543210',
  gstin: '06AAAAA0000A1Z5',
  dlNo: 'DL-1',
};

const mockAuth = (role) =>
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: { id: 'u1', username: 'tester', name: 'Tester', role },
    company: { id: 'co1', name: 'Test Pharma' },
    isAdmin: role === 'admin',
    isViewer: role === 'viewer',
    needsOnboarding: false,
    logout: vi.fn(),
  });

const renderCustomers = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <Customers />
      </ToastProvider>
    </MemoryRouter>
  );

describe('Viewer role in the UI', () => {
  beforeEach(() => {
    customersApi.list.mockResolvedValue({
      data: { items: [customer], pagination: { totalPages: 1, totalItems: 1 } },
    });
  });

  it('shows a viewer the data without any way to change it', async () => {
    mockAuth('viewer');
    renderCustomers();

    expect(await screen.findByText('City Medicals')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Customer/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete$/i })).not.toBeInTheDocument();
  });

  it('shows an admin the same data with the controls', async () => {
    mockAuth('admin');
    renderCustomers();

    expect(await screen.findByText('City Medicals')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Customer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
  });
});

describe('Sidebar by role', () => {
  beforeEach(() => {
    vi.spyOn(ThemeContext, 'useTheme').mockReturnValue({
      theme: 'light',
      isDark: false,
      toggleTheme: vi.fn(),
    });
  });

  const renderSidebar = () =>
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

  it('brands the sidebar with the signed-in company', () => {
    mockAuth('admin');
    renderSidebar();

    expect(screen.getByRole('heading', { name: 'Test Pharma' })).toBeInTheDocument();
  });

  it('hides Settings from a viewer and labels their access', () => {
    mockAuth('viewer');
    renderSidebar();

    expect(screen.queryByRole('link', { name: /Settings/i })).not.toBeInTheDocument();
    expect(screen.getByText('View only')).toBeInTheDocument();
  });

  it('offers Settings to an admin', () => {
    mockAuth('admin');
    renderSidebar();

    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });
});
