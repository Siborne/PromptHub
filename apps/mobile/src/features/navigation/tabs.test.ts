import { describe, expect, it } from 'vitest';

import { MOBILE_TABS } from './tabs';

describe('MOBILE_TABS', () => {
  it('exposes the first mobile shell routes in a stable order', () => {
    expect(MOBILE_TABS.map((tab) => tab.routeName)).toEqual([
      'prompts',
      'skills',
      'store',
      'settings',
    ]);
  });

  it('keeps every tab localized and icon-backed', () => {
    for (const tab of MOBILE_TABS) {
      expect(tab.titleKey).toMatch(/^tabs\./);
      expect(tab.symbol.ios.length).toBeGreaterThan(0);
      expect(tab.symbol.android.length).toBeGreaterThan(0);
      expect(tab.symbol.web.length).toBeGreaterThan(0);
    }
  });
});
