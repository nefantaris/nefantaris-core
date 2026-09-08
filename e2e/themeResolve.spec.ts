import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { runNef } from "./commands";
import {
    createThemeRepo,
    makeTempDir,
    secondCommitMarker,
    testThemeDir,
    writeTempSite,
} from "./tempSite";

const themeCacheDir = (siteDir: string): string =>
    join(siteDir, ".nefantaris", "themes");

const cachedThemeNames = async (siteDir: string): Promise<string[]> => {
    const cacheDir = themeCacheDir(siteDir);
    return existsSync(cacheDir) ? readdir(cacheDir) : [];
};

const onlyCachedTheme = async (siteDir: string): Promise<string> => {
    const names = await cachedThemeNames(siteDir);
    expect(names).toHaveLength(1);
    return join(themeCacheDir(siteDir), names[0]);
};

const inspectTemplates = (stdout: string): string[] =>
    (JSON.parse(stdout) as { templates: string[] }).templates;

test.describe("theme resolution", () => {
    test("builds a site from a git theme pinned to a tag", async () => {
        test.setTimeout(240_000);
        const root = await makeTempDir("git-theme");
        const repo = await createThemeRepo(join(root, "theme-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, { source: repo.url, version: repo.tag });

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stderr).toContain(
            `Fetching theme ${repo.url} at ${repo.tag}`
        );
        expect(result.stdout).toContain("Prerendered 12 routes");
        expect(
            await readFile(join(siteDir, "dist", "index.html"), "utf8")
        ).toContain("<h1>Welcome</h1>");
        const cached = await onlyCachedTheme(siteDir);
        expect(existsSync(join(cached, ".git"))).toBe(false);
        expect(await readFile(join(cached, "theme.css"), "utf8")).not.toContain(
            secondCommitMarker
        );
    });

    test("pins a full commit SHA", async () => {
        const root = await makeTempDir("git-sha");
        const repo = await createThemeRepo(join(root, "theme-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, {
            source: repo.url,
            version: repo.headSha,
        });

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(inspectTemplates(result.stdout)).toContain("page");
        const cached = await onlyCachedTheme(siteDir);
        expect(await readFile(join(cached, "theme.css"), "utf8")).toContain(
            secondCommitMarker
        );
    });

    test("reuses the cache after the remote disappears", async () => {
        const root = await makeTempDir("git-cache");
        const repo = await createThemeRepo(join(root, "theme-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, { source: repo.url, version: repo.tag });

        const online = await runNef(["inspect", siteDir, "--json"]);
        expect(online.exitCode, online.stderr).toBe(0);
        expect(online.stderr).toContain("Fetching theme");
        await rm(repo.repoDir, { recursive: true, force: true });

        const offline = await runNef(["inspect", siteDir, "--json"]);

        expect(offline.exitCode, offline.stderr).toBe(0);
        expect(offline.stderr).not.toContain("Fetching theme");
        expect(inspectTemplates(offline.stdout)).toContain("page");
    });

    test("fails when the theme is neither cached nor reachable", async () => {
        const root = await makeTempDir("git-offline");
        const missingUrl = pathToFileURL(join(root, "missing-repo")).href;
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, { source: missingUrl, version: "v1.0.0" });

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
            `Could not fetch theme ${missingUrl} at v1.0.0`
        );
        expect(result.stderr).toContain("Nothing is cached for it");
        expect(await cachedThemeNames(siteDir)).toEqual([]);
    });

    test("rejects a branch name as a version", async () => {
        const root = await makeTempDir("git-branch");
        const repo = await createThemeRepo(join(root, "theme-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, { source: repo.url, version: "main" });

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(`${repo.url} has no tag "main"`);
        expect(result.stderr).toContain("Tags available: v1.0.0");
        expect(await cachedThemeNames(siteDir)).toEqual([]);
    });

    test("requires a version for a git source", async () => {
        const root = await makeTempDir("git-unpinned");
        const repo = await createThemeRepo(join(root, "theme-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, { source: repo.url });

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
            '"theme.version" is required when "theme.source" is a git URL'
        );
    });

    test("rejects a pinned version on a local path", async () => {
        const root = await makeTempDir("local-pinned");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, {
            source: testThemeDir,
            version: "v1.0.0",
        });

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
            '"theme.version" must be "local" when "theme.source" is a path'
        );
    });

    test("still resolves a relative local path", async () => {
        const root = await makeTempDir("local-relative");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, {
            source: relative(siteDir, testThemeDir),
            version: "local",
        });

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(inspectTemplates(result.stdout)).toContain("page");
        expect(existsSync(themeCacheDir(siteDir))).toBe(false);
    });
});
