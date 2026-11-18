import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductPhoto } from '@/components/tenant/ProductPhoto';

const mocks = vi.hoisted(() => ({ createSignedUrl: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl }) },
} }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Product photo loading', () => {
  it('does not request a signed URL for an absent optional photo', () => {
    render(<ProductPhoto path={undefined} name="Panel" />);
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('uses the signed URL for the saved product photo', async () => {
    mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://example.com/panel.jpg' }, error: null });
    render(<ProductPhoto path="owner/panel.jpg" name="Panel" />);
    await waitFor(() => expect(screen.getByRole('img', { name: 'Panel' }).getAttribute('src')).toBe('https://example.com/panel.jpg'));
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('owner/panel.jpg', 3600);
  });

  it('handles failed photo requests without an unhandled rejection', async () => {
    mocks.createSignedUrl.mockRejectedValue(new Error('Network unavailable'));
    render(<ProductPhoto path="owner/panel.jpg" name="Panel" />);
    await waitFor(() => expect(mocks.createSignedUrl).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('img', { name: 'Panel' })).toBeNull();
  });
});