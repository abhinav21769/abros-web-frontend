import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import * as client from '../../api/client';

function TestConsumer() {
  const { user, isAuthenticated, loading, login, logout } = useAuth();

  if (loading) return <div>Loading auth...</div>;

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'Logged In' : 'Logged Out'}</div>
      <div data-testid="username">{user?.username || 'No user'}</div>
      <button onClick={() => login('admin', 'password123')}>Login Action</button>
      <button onClick={logout}>Logout Action</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders logged out when no token exists in localStorage', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('auth-status')).toHaveTextContent('Logged Out');
    expect(screen.getByTestId('username')).toHaveTextContent('No user');
  });

  it('loads user profile when token exists in storage', async () => {
    client.setAuthToken('test-jwt-token');
    vi.spyOn(client.authApi, 'me').mockResolvedValueOnce({
      data: { user: { username: 'testpharmacist', name: 'Pharmacist' } },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('auth-status')).toHaveTextContent('Logged In');
    expect(screen.getByTestId('username')).toHaveTextContent('testpharmacist');
  });

  it('handles login and logout successfully', async () => {
    const user = userEvent.setup();
    vi.spyOn(client.authApi, 'login').mockResolvedValueOnce({
      data: {
        token: 'new-token-123',
        user: { username: 'newuser', name: 'New User' },
      },
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(await screen.findByTestId('auth-status')).toHaveTextContent('Logged Out');

    await user.click(screen.getByText('Login Action'));

    expect(await screen.findByTestId('auth-status')).toHaveTextContent('Logged In');
    expect(screen.getByTestId('username')).toHaveTextContent('newuser');
    expect(client.getAuthToken()).toBe('new-token-123');

    await user.click(screen.getByText('Logout Action'));

    expect(screen.getByTestId('auth-status')).toHaveTextContent('Logged Out');
    expect(client.getAuthToken()).toBeNull();
  });
});
