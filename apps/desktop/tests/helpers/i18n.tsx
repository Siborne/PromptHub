import { act, render, type RenderOptions } from "@testing-library/react";
import { createInstance } from "i18next";
import { initReactI18next, I18nextProvider } from "react-i18next";
import type { PropsWithChildren, ReactElement } from "react";

import de from "../../src/renderer/i18n/locales/de.json";
import en from "../../src/renderer/i18n/locales/en.json";
import es from "../../src/renderer/i18n/locales/es.json";
import fr from "../../src/renderer/i18n/locales/fr.json";
import ja from "../../src/renderer/i18n/locales/ja.json";
import zhTW from "../../src/renderer/i18n/locales/zh-TW.json";
import zh from "../../src/renderer/i18n/locales/zh.json";
import { withAgentDefinitionMessages } from "../../src/renderer/i18n/locales/agent-definitions";

const resources = {
  en: { translation: withAgentDefinitionMessages("en", en) },
  zh: { translation: withAgentDefinitionMessages("zh", zh) },
  "zh-TW": {
    translation: withAgentDefinitionMessages("zh-TW", zhTW),
  },
  ja: { translation: withAgentDefinitionMessages("ja", ja) },
  es: { translation: withAgentDefinitionMessages("es", es) },
  de: { translation: withAgentDefinitionMessages("de", de) },
  fr: { translation: withAgentDefinitionMessages("fr", fr) },
};

export async function createTestI18n(language = "en") {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export async function renderWithI18n(
  ui: ReactElement,
  options?: RenderOptions & {
    language?: keyof typeof resources;
    settleAsyncEffects?: boolean;
  },
) {
  const {
    language = "en",
    settleAsyncEffects = false,
    ...renderOptions
  } = options ?? {};
  const i18n = await createTestI18n(language);

  function Wrapper({ children }: PropsWithChildren) {
    return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  if (settleAsyncEffects) {
    await act(async () => {
      await Promise.resolve();
    });
  }

  return {
    i18n,
    ...result,
  };
}
