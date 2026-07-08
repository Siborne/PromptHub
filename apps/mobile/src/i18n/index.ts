import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from './resources';

function detectLanguage() {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const normalized = locale.toLowerCase();

  if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk')) {
    return 'zh-TW';
  }

  if (normalized.startsWith('zh')) {
    return 'zh';
  }

  const language = normalized.split('-')[0];
  return language in resources ? language : 'zh';
}

void i18next.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false,
  },
  lng: detectLanguage(),
  resources,
});

export { i18next };
