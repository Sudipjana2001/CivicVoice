import { describe, expect, it } from 'vitest';
import { getIndiaStateLabel } from '@/lib/postAssistant';

describe('getIndiaStateLabel', () => {
  it('returns the label for a known state code', () => {
    expect(getIndiaStateLabel('wb')).toBe('West Bengal');
  });

  it('returns undefined for an unknown code', () => {
    expect(getIndiaStateLabel('XX')).toBeUndefined();
  });
});
