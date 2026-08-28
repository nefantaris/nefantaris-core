import { expect, test } from "@playwright/test";
import { collectPageProblems } from "./collectPageProblems";
import {
    notFoundTitle,
    prerenderedRoutes,
    previewBaseUrl,
} from "./fixtureSite";
import { waitForHydration } from "./waitForHydration";

for (const route of prerenderedRoutes) {
    test(`${route.path} hydrates without console errors`, async ({ page }) => {
        const problems = collectPageProblems(page);

        await page.goto(route.path);
        await waitForHydration(page);

        await expect(page).toHaveTitle(route.title);
        await expect(
            page.getByRole("heading", { level: 1, name: route.heading })
        ).toBeVisible();
        expect(problems.consoleErrors).toEqual([]);
        expect(problems.failedRequests).toEqual([]);
    });
}

test("the 404 response hydrates into the notFound template", async ({
    page,
}) => {
    const problems = collectPageProblems(page);

    await page.goto("/definitely-not-a-page");
    await waitForHydration(page);

    await expect(page).toHaveTitle(notFoundTitle);
    await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible();
    expect(problems.consoleErrors).toEqual([]);
    expect(problems.failedRequests).toEqual([
        `404 ${previewBaseUrl}/definitely-not-a-page`,
    ]);
});

test("React adopts the prerendered DOM instead of replacing it", async ({
    page,
}) => {
    await page.addInitScript(() => {
        const record = { wasRootEmptied: false };
        Object.assign(window, { nefantarisHydrationRecord: record });
        new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                const target = mutation.target as Element;
                if (target.id === "root" && mutation.removedNodes.length > 0) {
                    record.wasRootEmptied = true;
                }
            }
        }).observe(document, { childList: true, subtree: true });
    });

    await page.goto("/custom-route");
    await waitForHydration(page);

    const wasRootEmptied = await page.evaluate(
        () =>
            (
                window as unknown as {
                    nefantarisHydrationRecord: { wasRootEmptied: boolean };
                }
            ).nefantarisHydrationRecord.wasRootEmptied
    );
    expect(wasRootEmptied).toBe(false);
});
