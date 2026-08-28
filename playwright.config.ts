import { defineConfig, devices } from "@playwright/test";
import { previewBaseUrl } from "./e2e/fixtureSite";

const isContinuousIntegration = process.env.CI !== undefined;

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: isContinuousIntegration,
    retries: isContinuousIntegration ? 2 : 0,
    workers: isContinuousIntegration ? 1 : undefined,
    reporter: [["line"], ["html", { open: "never" }]],
    use: {
        baseURL: previewBaseUrl,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "prerendered",
            testMatch: "prerender.spec.ts",
            use: { ...devices["Desktop Chrome"], javaScriptEnabled: false },
        },
        {
            name: "hydrated",
            testIgnore: "prerender.spec.ts",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "npx tsx e2e/serveFixture.ts",
        url: previewBaseUrl,
        reuseExistingServer: !isContinuousIntegration,
    },
});
