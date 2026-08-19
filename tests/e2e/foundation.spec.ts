import { expect, test } from "@playwright/test";

test("sign-in is responsive and has visible keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await expect(page.locator(".shell")).toHaveCSS("padding-left", "16px");
  await page.keyboard.press("Tab");
  const email = page.getByRole("textbox", { name: "Email" });
  await expect(email).toBeFocused();
  await expect(email).toHaveCSS("outline-color", "rgb(138, 82, 0)");
  const button = page.getByRole("button", { name: "Sign in" });
  await expect(button).toHaveCSS("min-height", "48px");
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator(".shell")).toHaveCSS("padding-left", "32px");
  await expect(page.getByRole("heading", { name: "Sign in to practice" })).toBeVisible();
});

test("server responses apply the security header policy", async ({ request }) => {
  const response = await request.get("/");
  expect(response.headers()).toMatchObject({
    "cache-control": expect.any(String),
    "content-type": expect.stringContaining("text/html"),
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY"
  });
});
