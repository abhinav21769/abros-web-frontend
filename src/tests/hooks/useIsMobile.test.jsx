import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useIsMobile, { MOBILE_QUERY } from '../../hooks/useIsMobile';

describe('useIsMobile', () => {
  it('follows the mobile breakpoint media query', () => {
    window.matchMedia.mockImplementation((query) => ({
      matches: query === MOBILE_QUERY,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('is false on wide screens', () => {
    window.matchMedia.mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });
});
