import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runNef } from "./commands";
import { fixtureDistDir } from "./fixtureSite";
import {
    amendJsonFile,
    makeTempDir,
    testThemeDir,
    writeTempSite,
    writeThemeDir,
} from "./tempSite";
import { waitForHydration } from "./waitForHydration";

const localTheme = { source: testThemeDir, version: "local" };
const storageKey = "nefantaris-mode";
const fixtureHtmlOpenTag =
    '<html lang="en" data-modes="light dark" data-default-mode="system">';

const appliedMode = (page: Page): Promise<string | undefined> =>
    page.evaluate(() => document.documentElement.dataset.mode);

const storedMode = (page: Page): Promise<string | null> =>
    page.evaluate((key) => localStorage.getItem(key), storageKey);

const writeSiteModes = (
    siteDir: string,
    modes: Record<string, unknown>
): Promise<void> => amendJsonFile(join(siteDir, "nefantaris.json"), { modes });

const writeThemeModes = async (
    themeDir: string,
    modes: unknown[]
): Promise<void> => {
    await writeThemeDir(themeDir);
    await amendJsonFile(join(themeDir, "theme.json"), { modes });
};

const failedBuild = async (siteDir: string): Promise<string> => {
    const result = await runNef(["build", siteDir]);
    expect(result.exitCode).toBe(1);
    return result.stderr;
};

test.describe("modes", () => {
    test("the prerendered fixture declares its modes on <html> and ships the pre-paint script", async () => {
        const html = await readFile(join(fixtureDistDir, "index.html"), "utf8");

        expect(html).toContain(fixtureHtmlOpenTag);
        expect(html).not.toContain(' data-mode="');
        expect(html).toContain(`localStorage.getItem("${storageKey}")`);
        expect(html).toContain("(prefers-color-scheme: dark)");
        expect(html).toContain("data-mode-switch");
        expect(html).toContain("Switch to dark mode");
    });

    test("applies the system preference before hydration and follows it while no choice is stored", async ({
        page,
    }) => {
        await page.emulateMedia({ colorScheme: "dark" });
        await page.goto("/");
        expect(await appliedMode(page)).toBe("dark");
        await waitForHydration(page);
        const modeSwitch = page.locator("[data-mode-switch]");
        await expect(modeSwitch).toHaveText("Switch to light mode");

        await page.emulateMedia({ colorScheme: "light" });

        await expect(page.locator("html")).toHaveAttribute(
            "data-mode",
            "light"
        );
        await expect(modeSwitch).toHaveText("Switch to dark mode");
        expect(await storedMode(page)).toBeNull();
    });

    test("the switch stores the visitor's choice and it survives a reload under the opposite preference", async ({
        page,
    }) => {
        await page.emulateMedia({ colorScheme: "dark" });
        await page.goto("/");
        await waitForHydration(page);
        const html = page.locator("html");
        const modeSwitch = page.locator("[data-mode-switch]");
        await expect(html).toHaveAttribute("data-mode", "dark");

        await modeSwitch.click();

        await expect(html).toHaveAttribute("data-mode", "light");
        await expect(modeSwitch).toHaveText("Switch to dark mode");
        expect(await storedMode(page)).toBe("light");

        await page.reload();

        expect(await appliedMode(page)).toBe("light");
        await waitForHydration(page);
        await expect(modeSwitch).toHaveText("Switch to dark mode");
        await page.emulateMedia({ colorScheme: "light" });
        await page.emulateMedia({ colorScheme: "dark" });
        await expect(html).toHaveAttribute("data-mode", "light");
    });

    test("a site that excludes light and defaults to dark builds without a switch", async () => {
        test.setTimeout(300_000);
        const root = await makeTempDir("modes-dark-only");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);
        await writeSiteModes(siteDir, { exclude: ["light"], default: "dark" });

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        const html = await readFile(
            join(siteDir, "dist", "index.html"),
            "utf8"
        );
        expect(html).toContain(
            '<html lang="en" data-modes="dark" data-default-mode="dark" data-mode="dark">'
        );
        expect(html).not.toContain("data-mode-switch");
    });

    test("rejects excluding a mode the theme does not declare", async () => {
        const root = await makeTempDir("modes-undeclared");
        const themeDir = join(root, "theme");
        await writeThemeModes(themeDir, ["light"]);
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, { source: themeDir, version: "local" });
        await writeSiteModes(siteDir, { exclude: ["dark"] });

        const stderr = await failedBuild(siteDir);

        expect(stderr).toContain(join(siteDir, "nefantaris.json"));
        expect(stderr).toContain(
            '"modes.exclude[0]" is "dark", which theme "nefantaris-test-theme" does not declare'
        );
        expect(stderr).toContain('it declares "light"');
    });

    test('rejects a "system" default when one mode is available', async () => {
        const root = await makeTempDir("modes-system-single");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);
        await writeSiteModes(siteDir, { exclude: ["dark"], default: "system" });

        const stderr = await failedBuild(siteDir);

        expect(stderr).toContain(
            '"modes.default" is "system", but only "light" is available'
        );
    });

    test("rejects a default that the site excluded", async () => {
        const root = await makeTempDir("modes-default-excluded");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);
        await writeSiteModes(siteDir, { exclude: ["light"], default: "light" });

        const stderr = await failedBuild(siteDir);

        expect(stderr).toContain(
            '"modes.default" is "light", which is not available — the available modes are "dark"'
        );
    });

    test("rejects excluding every mode", async () => {
        const root = await makeTempDir("modes-exclude-all");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);
        await writeSiteModes(siteDir, { exclude: ["light", "dark"] });

        const stderr = await failedBuild(siteDir);

        expect(stderr).toContain(
            '"modes.exclude" removes every mode theme "nefantaris-test-theme" declares'
        );
    });

    test("rejects an unknown key and a repeated mode under modes", async () => {
        const root = await makeTempDir("modes-shape");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);

        await writeSiteModes(siteDir, { colour: "dark" });
        expect(await failedBuild(siteDir)).toContain(
            '"modes.colour" is not a recognised key — modes accepts "default", "exclude"'
        );

        await writeSiteModes(siteDir, { exclude: ["dark", "dark"] });
        expect(await failedBuild(siteDir)).toContain(
            '"modes.exclude" must not repeat a mode'
        );

        await writeSiteModes(siteDir, { default: "sepia" });
        expect(await failedBuild(siteDir)).toContain(
            '"modes.default" must be "light", "dark", or "system"'
        );
    });

    test("rejects a mode outside the vocabulary in theme.json", async () => {
        const root = await makeTempDir("modes-bad-theme");
        const themeDir = join(root, "theme");
        await writeThemeModes(themeDir, ["light", "sepia"]);
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, { source: themeDir, version: "local" });

        const stderr = await failedBuild(siteDir);

        expect(stderr).toContain(join(themeDir, "theme.json"));
        expect(stderr).toContain('"modes[1]" must be "light" or "dark"');
    });

    test("nef inspect --json reports the resolved modes", async () => {
        const root = await makeTempDir("modes-inspect");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode, result.stderr).toBe(0);
        const inspection: unknown = JSON.parse(result.stdout);
        expect(inspection).toMatchObject({
            modes: { available: ["light", "dark"], default: "system" },
        });
    });
});
