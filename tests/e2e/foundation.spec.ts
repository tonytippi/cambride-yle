import { expect, test } from "@playwright/test";

test("base shell is responsive and has visible keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.locator(".shell")).toHaveCSS("padding-left", "16px");
  await page.keyboard.press("Tab");
  const button = page.getByRole("button", { name: "Explore the workspace" });
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS("outline-color", "rgb(138, 82, 0)");
  await expect(button).toHaveCSS("min-height", "48px");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".shell")).toHaveCSS("padding-left", "32px");
  await expect(page.getByRole("heading", { name: "Ready for focused practice" })).toBeVisible();
});
