import { expect, test, type Page } from "@playwright/test";
import { collectPageProblems } from "./collectPageProblems";
import { navLinks, siteName } from "./fixtureSite";
import { waitForHydration } from "./waitForHydration";

const documentMarker = "nefantarisNavigationProbe";

const markDocument = (page: Page): Promise<void> =>
    page.evaluate((marker) => {
        Object.assign(window, { [marker]: true });
    }, documentMarker);

const isDocumentStillMarked = (page: Page): Promise<boolean> =>
    page.evaluate((marker) => marker in window, documentMarker);

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Main" });

test("nav links navigate client-side without reloading", async ({ page }) => {
    const problems = collectPageProblems(page);
    await page.goto("/");
    await waitForHydration(page);
    await markDocument(page);

    await mainNav(page)
        .getByRole("link", { name: "Blog", exact: true })
        .click();
    await expect(page).toHaveURL("/blog");
    await expect(page).toHaveTitle(`Blog — ${siteName}`);
    await expect(
        page.getByRole("heading", { level: 1, name: "Blog" })
    ).toBeVisible();
    expect(await isDocumentStillMarked(page)).toBe(true);

    await page.getByRole("link", { name: "Hello, world", exact: true }).click();
    await expect(page).toHaveURL("/blog/hello-world");
    await expect(page).toHaveTitle(`Hello, world — ${siteName}`);
    expect(await isDocumentStillMarked(page)).toBe(true);

    await page.goBack();
    await expect(page).toHaveURL("/blog");
    await expect(page).toHaveTitle(`Blog — ${siteName}`);
    expect(await isDocumentStillMarked(page)).toBe(true);
    expect(problems.consoleErrors).toEqual([]);
});

test("aria-current follows client-side navigation", async ({ page }) => {
    await page.goto("/");
    await waitForHydration(page);

    for (const target of navLinks) {
        await mainNav(page)
            .getByRole("link", { name: target.label, exact: true })
            .click();
        await expect(page).toHaveURL(target.href);

        for (const item of navLinks) {
            const link = mainNav(page).getByRole("link", {
                name: item.label,
                exact: true,
            });
            if (item.href === target.href) {
                await expect(link).toHaveAttribute("aria-current", "page");
            } else {
                await expect(link).not.toHaveAttribute("aria-current", "page");
            }
        }
    }
});

test("internal markdown links become client-side routes", async ({ page }) => {
    await page.goto("/markdown");
    await waitForHydration(page);
    await markDocument(page);

    await page.getByRole("link", { name: "internal link" }).click();
    await expect(page).toHaveURL("/about");
    await expect(
        page.getByRole("heading", { level: 1, name: "About" })
    ).toBeVisible();
    expect(await isDocumentStillMarked(page)).toBe(true);
});

test("the notFound template links back to the home route", async ({ page }) => {
    await page.goto("/definitely-not-a-page");
    await waitForHydration(page);
    await markDocument(page);

    await page.getByRole("link", { name: `Back to ${siteName}` }).click();
    await expect(page).toHaveURL("/");
    await expect(
        page.getByRole("heading", { level: 1, name: "Welcome" })
    ).toBeVisible();
    expect(await isDocumentStillMarked(page)).toBe(true);
});
