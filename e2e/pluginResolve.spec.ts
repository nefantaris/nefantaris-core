import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { coreDir, runNef } from "./commands";
import {
    createPluginRepo,
    createThemeRepo,
    makeTempDir,
    secondCommitFileName,
    testPluginDependencies,
    testPluginName,
    testThemeDir,
    writeTempSite,
    writeTestPlugin,
    writeThemeDir,
} from "./tempSite";

const localTheme = { source: testThemeDir, version: "local" };
const dateFnsVersion = testPluginDependencies["date-fns"];

const pluginCacheDir = (siteDir: string): string =>
    join(siteDir, ".nefantaris", "plugins");

const pluginStoreDir = (siteDir: string): string =>
    join(siteDir, ".nefantaris", "plugin-store");

const onlyCachedPlugin = async (siteDir: string): Promise<string> => {
    const names = await readdir(pluginCacheDir(siteDir));
    expect(names).toHaveLength(1);
    return join(pluginCacheDir(siteDir), names[0]);
};

const readPackageVersion = async (packageDir: string): Promise<string> =>
    (
        JSON.parse(
            await readFile(join(packageDir, "package.json"), "utf8")
        ) as { version: string }
    ).version;

const readEjectedDependencies = async (
    outDir: string
): Promise<Record<string, string>> =>
    (
        JSON.parse(await readFile(join(outDir, "package.json"), "utf8")) as {
            dependencies: Record<string, string>;
        }
    ).dependencies;

const readConfiguredPlugins = async (siteDir: string): Promise<unknown> =>
    (
        JSON.parse(
            await readFile(join(siteDir, "nefantaris.json"), "utf8")
        ) as { plugins: unknown }
    ).plugins;

test.describe("plugin resolution", () => {
    test("builds a site from a git plugin pinned to a tag", async () => {
        test.setTimeout(300_000);
        const root = await makeTempDir("git-plugin");
        const repo = await createPluginRepo(join(root, "plugin-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme, [
            { name: testPluginName, source: repo.url, version: repo.tag },
        ]);

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stderr).toContain(
            `Fetching plugin ${repo.url} at ${repo.tag}`
        );
        expect(result.stdout).toContain("Prerendered 12 routes");
        const snapshot = await onlyCachedPlugin(siteDir);
        expect(existsSync(join(snapshot, ".git"))).toBe(false);
        expect(existsSync(join(snapshot, secondCommitFileName))).toBe(false);
        expect(
            await readPackageVersion(
                join(pluginStoreDir(siteDir), "node_modules", "date-fns")
            )
        ).toBe(dateFnsVersion);
        const generated = await readFile(
            join(siteDir, ".nefantaris", "src", "generated", "plugins.ts"),
            "utf8"
        );
        expect(generated).toContain(pluginStoreDir(siteDir));
        expect(generated).not.toContain(coreDir);
    });

    test("pins a full commit SHA", async () => {
        const root = await makeTempDir("plugin-sha");
        const repo = await createPluginRepo(join(root, "plugin-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme, [
            { name: testPluginName, source: repo.url, version: repo.headSha },
        ]);

        const result = await runNef([
            "eject",
            siteDir,
            "--out",
            join(root, "ejected"),
        ]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stderr).toContain(
            `Fetching plugin ${repo.url} at ${repo.headSha}`
        );
        const snapshot = await onlyCachedPlugin(siteDir);
        expect(existsSync(join(snapshot, secondCommitFileName))).toBe(true);
    });

    test("resolves a plugin pinned to a local path", async () => {
        const root = await makeTempDir("plugin-local");
        await writeTestPlugin(join(root, "local-plugins", testPluginName));
        const siteDir = join(root, "site");
        const outDir = join(root, "ejected");
        await writeTempSite(siteDir, localTheme, [
            {
                name: testPluginName,
                source: join("..", "local-plugins", testPluginName),
                version: "local",
            },
        ]);

        const result = await runNef(["eject", siteDir, "--out", outDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(await readEjectedDependencies(outDir)).toMatchObject(
            testPluginDependencies
        );
        expect(existsSync(pluginCacheDir(siteDir))).toBe(false);
    });

    test("fetches a plugin a theme requires under nef theme check", async () => {
        test.setTimeout(600_000);
        const root = await makeTempDir("plugin-required");
        const repo = await createPluginRepo(join(root, "plugin-repo"));
        const themeDir = join(root, "theme");
        await writeThemeDir(themeDir, [
            { name: testPluginName, source: repo.url, version: repo.tag },
        ]);

        const result = await runNef(["theme", "check", themeDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stderr).toContain(
            `Fetching plugin ${repo.url} at ${repo.tag}`
        );
        const snapshot = await onlyCachedPlugin(themeDir);
        expect(existsSync(join(snapshot, "plugin.json"))).toBe(true);
        expect(
            await readPackageVersion(
                join(pluginStoreDir(themeDir), "node_modules", "date-fns")
            )
        ).toBe(dateFnsVersion);
    });

    test("carries a theme's plugin pins into a site nef init scaffolds", async () => {
        const root = await makeTempDir("plugin-init");
        const plugin = await createPluginRepo(join(root, "plugin-repo"));
        const pin = {
            name: testPluginName,
            source: plugin.url,
            version: plugin.tag,
        };
        const theme = await createThemeRepo(join(root, "theme-repo"), [pin]);
        const siteDir = join(root, "new-site");

        const result = await runNef([
            "init",
            siteDir,
            "--theme",
            theme.url,
            "--theme-version",
            theme.tag,
        ]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain(
            `Created a Nefantaris site at ${siteDir}`
        );
        expect(await readConfiguredPlugins(siteDir)).toEqual([pin]);
    });

    test("writes a pinned entry for nef plugins add --source", async () => {
        const root = await makeTempDir("plugin-add");
        const repo = await createPluginRepo(join(root, "plugin-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);

        const result = await runNef([
            "plugins",
            "add",
            testPluginName,
            siteDir,
            "--source",
            repo.url,
            "--version",
            repo.tag,
        ]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain(`Added "${testPluginName}"`);
        expect(await readConfiguredPlugins(siteDir)).toEqual([
            { name: testPluginName, source: repo.url, version: repo.tag },
        ]);
    });

    test("rejects nef plugins add --version without --source", async () => {
        const root = await makeTempDir("plugin-add-unsourced");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);

        const result = await runNef([
            "plugins",
            "add",
            testPluginName,
            siteDir,
            "--version",
            "v1.0.0",
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("--version needs --source");
        expect(await readConfiguredPlugins(siteDir)).toEqual([]);
    });

    test("rejects nef plugins add under a name the manifest disagrees with", async () => {
        const root = await makeTempDir("plugin-add-misnamed");
        const repo = await createPluginRepo(join(root, "plugin-repo"));
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);

        const result = await runNef([
            "plugins",
            "add",
            "wrong-name",
            siteDir,
            "--source",
            repo.url,
            "--version",
            repo.tag,
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(`"name" is "${testPluginName}"`);
        expect(result.stderr).toContain('enabled as "wrong-name"');
        expect(await readConfiguredPlugins(siteDir)).toEqual([]);
    });

    test("rejects a theme that pins a required plugin to a path", async () => {
        const root = await makeTempDir("plugin-required-path");
        const themeDir = join(root, "theme");
        await writeThemeDir(themeDir, [
            {
                name: testPluginName,
                source: join("..", "local-plugins", testPluginName),
                version: "local",
            },
        ]);
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, { source: themeDir, version: "local" });

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('"requires[0].source" is a path');
        expect(result.stderr).toContain(
            "a theme pins the plugins it requires to a git URL"
        );
    });

    test("rejects the same plugin listed twice", async () => {
        const root = await makeTempDir("plugin-duplicate");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme, [
            testPluginName,
            testPluginName,
        ]);

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
            `"plugins[1]" lists "${testPluginName}" again`
        );
    });
});
