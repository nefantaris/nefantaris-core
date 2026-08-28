import type { Page } from "@playwright/test";

export const waitForHydration = async (page: Page): Promise<void> => {
    await page.waitForFunction(() => {
        const root = document.querySelector("#root");
        if (root === null) {
            return false;
        }
        return Object.keys(root).some((key) =>
            key.startsWith("__reactContainer")
        );
    });
};
