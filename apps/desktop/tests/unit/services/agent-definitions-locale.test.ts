import { describe, expect, it } from "vitest";

import { agentDefinitionMessages } from "../../../src/renderer/i18n/locales/agent-definitions";

function keyPaths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return nested && typeof nested === "object"
      ? keyPaths(nested as object, path)
      : [path];
  });
}

describe("Agent definition locale resources", () => {
  it("keeps every supported locale structurally aligned with English", () => {
    const expected = keyPaths(agentDefinitionMessages.en).sort();
    expect(Object.keys(agentDefinitionMessages).sort()).toEqual([
      "de",
      "en",
      "es",
      "fr",
      "ja",
      "zh",
      "zh-TW",
    ]);
    for (const messages of Object.values(agentDefinitionMessages)) {
      expect(keyPaths(messages).sort()).toEqual(expected);
    }
  });
});
