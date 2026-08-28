import { expect, test, type Page } from "@playwright/test";
import { waitForHydration } from "./waitForHydration";

const maximumTabPresses = 40;

const isScrollRegionFocused = (page: Page): Promise<boolean> =>
    page.evaluate(
        () => document.activeElement?.hasAttribute("data-table-scroll") === true
    );

const tabUntilScrollRegionFocused = async (page: Page): Promise<boolean> => {
    for (let press = 0; press < maximumTabPresses; press += 1) {
        await page.keyboard.press("Tab");
        if (await isScrollRegionFocused(page)) {
            return true;
        }
    }
    return false;
};

const accessibilityRoles = async (page: Page): Promise<unknown[]> => {
    const session = await page.context().newCDPSession(page);
    await session.send("Accessibility.enable");
    const { nodes } = await session.send("Accessibility.getFullAXTree");
    await session.detach();
    return nodes.map((node) => node.role?.value);
};

test.describe("the table scroll region", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/markdown");
        await waitForHydration(page);
    });

    test("is reachable with the Tab key", async ({ page }) => {
        expect(await tabUntilScrollRegionFocused(page)).toBe(true);
        await expect(page.locator("[data-table-scroll]:focus")).toHaveCount(1);
    });

    test("scrolls without taking the table out of table display", async ({
        page,
    }) => {
        const region = page.locator("[data-table-scroll]");
        await expect(region).toHaveCSS("overflow-x", "auto");
        await expect(region.locator("> table")).toHaveCSS("display", "table");
    });

    test("keeps the table in the browser accessibility tree", async ({
        page,
    }) => {
        expect(await accessibilityRoles(page)).toContain("table");
    });
});
