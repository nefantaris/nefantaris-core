import type { Page } from "@playwright/test";

export type PageProblems = {
    consoleErrors: string[];
    failedRequests: string[];
};

const isResourceLoadFailure = (text: string): boolean =>
    text.startsWith("Failed to load resource:");

export const collectPageProblems = (page: Page): PageProblems => {
    const problems: PageProblems = { consoleErrors: [], failedRequests: [] };
    page.on("console", (message) => {
        if (
            message.type() === "error" &&
            !isResourceLoadFailure(message.text())
        ) {
            problems.consoleErrors.push(message.text());
        }
    });
    page.on("pageerror", (error) => {
        problems.consoleErrors.push(error.message);
    });
    page.on("response", (response) => {
        if (response.status() >= 400) {
            problems.failedRequests.push(
                `${String(response.status())} ${response.url()}`
            );
        }
    });
    return problems;
};
