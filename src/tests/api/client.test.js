import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  medicinesApi,
  customersApi,
  invoicesApi,
  purchasesApi,
} from '../../api/client';

describe('API Client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('manages auth token in localStorage', () => {
    expect(getAuthToken()).toBeNull();
    setAuthToken('token-abc-123');
    expect(getAuthToken()).toBe('token-abc-123');
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });

  it('attaches Authorization header to requests when token is present', async () => {
    setAuthToken('token-abc-123');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { items: [] } }),
    });
    global.fetch = mockFetch;

    await medicinesApi.list({ name: 'Paracetamol' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/medicines?name=Paracetamol');
    expect(options.headers.Authorization).toBe('Bearer token-abc-123');
  });

  it('throws extracted error message on API failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { message: 'Medicine name already exists' },
      }),
    });

    await expect(medicinesApi.create({ name: 'Duplicate' })).rejects.toThrow(
      'Medicine name already exists'
    );
  });
});
