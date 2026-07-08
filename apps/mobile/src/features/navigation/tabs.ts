export const MOBILE_TABS = [
  {
    routeName: 'prompts',
    titleKey: 'tabs.prompts',
    symbol: { ios: 'text.quote', android: 'article', web: 'article' },
  },
  {
    routeName: 'skills',
    titleKey: 'tabs.skills',
    symbol: { ios: 'shippingbox', android: 'inventory_2', web: 'inventory_2' },
  },
  {
    routeName: 'store',
    titleKey: 'tabs.store',
    symbol: { ios: 'storefront', android: 'storefront', web: 'storefront' },
  },
  {
    routeName: 'settings',
    titleKey: 'tabs.settings',
    symbol: { ios: 'gearshape', android: 'settings', web: 'settings' },
  },
] as const;

export type MobileTabRouteName = (typeof MOBILE_TABS)[number]['routeName'];
