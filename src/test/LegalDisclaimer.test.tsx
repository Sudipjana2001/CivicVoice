import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LegalDisclaimer } from '@/components/LegalDisclaimer';

const BANNER_DISMISSAL_STORAGE_KEY = 'civicvoice.banner-disclaimer-dismissed';

describe('LegalDisclaimer banner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('can be dismissed and remembers that choice', () => {
    render(<LegalDisclaimer variant="banner" />);

    expect(screen.getByText('Disclaimer:')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss disclaimer' }));

    expect(screen.queryByText('Disclaimer:')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(BANNER_DISMISSAL_STORAGE_KEY)).toBe('true');
  });

  it('stays hidden after a stored dismissal', () => {
    window.localStorage.setItem(BANNER_DISMISSAL_STORAGE_KEY, 'true');

    render(<LegalDisclaimer variant="banner" />);

    expect(screen.queryByText('Disclaimer:')).not.toBeInTheDocument();
  });
});
