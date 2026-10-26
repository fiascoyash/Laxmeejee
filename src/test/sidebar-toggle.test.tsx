import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Root from '@/legacy/Root';

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/#home');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function mountAtWidth(width: number) {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
    matches: query === '(min-width: 1024px)' && width >= 1024,
    media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  const result = render(<Root />);
  const sidebar = result.container.querySelector('aside');
  if (!sidebar) throw new Error('Sidebar not mounted');
  return { sidebar, toggle: screen.getByRole('button', { name: 'Toggle sidebar' }), container: result.container };
}

describe('Existing sidebar toggle', () => {
  it.each([1920, 1100])('repeatedly toggles desktop state at %i px and preserves it after navigation', async width => {
    const { sidebar, toggle } = mountAtWidth(width);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(toggle);
      expect(sidebar.dataset['desktopCollapsed']).toBe('true');
      fireEvent.click(toggle);
      expect(sidebar.dataset['desktopCollapsed']).toBe('false');
    }
    fireEvent.click(toggle);
    fireEvent.click(within(sidebar).getByRole('link', { name: 'Customers' }));
    await waitFor(() => expect(window.location.hash).toBe('#customers'));
    expect(sidebar.dataset['desktopCollapsed']).toBe('true');
  });

  it('keeps mobile drawer state separate from desktop collapse', async () => {
    const { sidebar, toggle, container } = mountAtWidth(390);
    for (let i = 0; i < 3; i++) {
      fireEvent.click(toggle);
      const overlay = container.querySelector('.fixed.inset-0');
      expect(overlay).not.toBeNull();
      expect(sidebar.dataset['desktopCollapsed']).toBe('false');
      if (!overlay) throw new Error('Drawer overlay not mounted');
      fireEvent.click(overlay);
      expect(container.querySelector('.fixed.inset-0')).toBeNull();
    }
    fireEvent.click(toggle);
    fireEvent.click(within(sidebar).getByRole('link', { name: 'Customers' }));
    await waitFor(() => expect(window.location.hash).toBe('#customers'));
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });
});