import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";

test("connect screen has no axe violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("h1:has-text('Reson8')");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
