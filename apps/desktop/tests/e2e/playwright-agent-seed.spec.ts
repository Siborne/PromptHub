import { expect, test as base } from "@playwright/test";

import { closePromptHub, launchPromptHub } from "./helpers/electron";

const test = base.extend({
  page: async ({}, providePage) => {
    const launched = await launchPromptHub("skills-smoke.seed.json");
    try {
      await providePage(launched.page);
    } finally {
      await closePromptHub(launched.app, launched.userDataDir);
    }
  },
});

test("seed", async ({ page }) => {
  await expect(page).toHaveTitle(/PromptHub/);
  await expect(page.getByRole("button", { name: "Skills" })).toBeVisible();
});
