import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Onboarding from '../../pages/Onboarding';
import { ToastProvider } from '../../context/ToastContext';
import { companyApi } from '../../api/client';
import * as AuthContext from '../../context/AuthContext';

vi.mock('../../api/client', () => ({
  companyApi: { completeOnboarding: vi.fn(), get: vi.fn(), update: vi.fn() },
}));

const updateCompany = vi.fn();

const mockAuth = (overrides = {}) => {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    company: { id: 'c1', name: 'Fresh Pharma', onboardingCompleted: false },
    isAdmin: true,
    needsOnboarding: true,
    loading: false,
    updateCompany,
    ...overrides,
  });
};

const renderWizard = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <Onboarding />
      </ToastProvider>
    </MemoryRouter>
  );

describe('Onboarding wizard', () => {
  beforeEach(() => {
    mockAuth();
    companyApi.completeOnboarding.mockResolvedValue({
      message: 'Company setup completed.',
      data: { company: { id: 'c1', name: 'Fresh Pharma', onboardingCompleted: true } },
    });
  });

  it('starts on the company step with the existing name filled in', () => {
    renderWizard();

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByLabelText(/Company name/i)).toHaveValue('Fresh Pharma');
  });

  it('will not move past the first step without a company name', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.clear(screen.getByLabelText(/Company name/i));
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    expect(await screen.findByText(/Company name is required/i)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('catches a malformed GSTIN on the step where it was typed', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();

    await user.type(screen.getByLabelText('GSTIN'), 'NOT-A-GSTIN');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    expect(await screen.findByText(/valid 15-character GST number/i)).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument();
  });

  it('submits the whole profile and marks setup complete', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.clear(screen.getByLabelText(/Company name/i));
    await user.type(screen.getByLabelText(/Company name/i), 'Fresh Pharma Pvt Ltd');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    await user.type(screen.getByLabelText('City'), 'Ambala');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    await user.type(screen.getByLabelText('GSTIN'), '06AAAAA0000A1Z5');
    await user.type(screen.getByLabelText(/Sale invoice prefix/i), 'FP');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    await user.type(screen.getByLabelText(/UPI ID/i), 'fresh@paytm');
    await user.click(screen.getByRole('button', { name: /Finish setup/i }));

    await waitFor(() => expect(companyApi.completeOnboarding).toHaveBeenCalledTimes(1));

    const payload = companyApi.completeOnboarding.mock.calls[0][0];
    expect(payload).toMatchObject({
      name: 'Fresh Pharma Pvt Ltd',
      city: 'Ambala',
      gstin: '06AAAAA0000A1Z5',
      invoicePrefix: 'FP',
      upiVpa: 'fresh@paytm',
    });
    // Blank optional rows never reach the API.
    expect(payload.dlNumbers).toEqual([]);
    expect(updateCompany).toHaveBeenCalled();
  });

  it('keeps a viewer out - they cannot complete setup', () => {
    mockAuth({ isAdmin: false });
    renderWizard();

    expect(screen.queryByText('Step 1 of 4')).not.toBeInTheDocument();
  });
});
