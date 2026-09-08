import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { coreDir, runNef, runNpm } from "./commands";
import { makeTempDir, testThemeDir, writeTempSite } from "./tempSite";

const testPluginName = "nefantaris-test-plugin";
const testPluginDependencies = { "date-fns": "4.4.0" };
const localTheme = { source: testThemeDir, version: "local" };

type PackageJson = {
    name: string;
    version: string;
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
};

const readPackageJson = async (dir: string): Promise<PackageJson> =>
    JSON.parse(
        await readFile(join(dir, "package.json"), "utf8")
    ) as PackageJson;

const writeTestPlugin = async (siteDir: string): Promise<void> => {
    const pluginDir = join(siteDir, "plugins", testPluginName);
    await mkdir(pluginDir, { recursive: true });
    const manifest = {
        name: testPluginName,
        contract: 1,
        provides: { dependencies: testPluginDependencies },
    };
    await writeFile(
        join(pluginDir, "plugin.json"),
        `${JSON.stringify(manifest, null, 4)}\n`
    );
};

test.describe("nef eject", () => {
    test("emits a project that installs and builds without Nefantaris", async () => {
        test.setTimeout(300_000);
        const root = await makeTempDir("eject");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme, [testPluginName]);
        await writeTestPlugin(siteDir);
        const outDir = join(root, "ejected");

        const ejected = await runNef(["eject", siteDir, "--out", outDir]);

        expect(ejected.exitCode, ejected.stderr).toBe(0);
        const packageJsonText = await readFile(
            join(outDir, "package.json"),
            "utf8"
        );
        expect(packageJsonText).not.toContain("@nefantaris");
        const packageJson = await readPackageJson(outDir);
        const template = await readPackageJson(join(coreDir, "site-template"));
        expect(packageJson.name).toBe("nefantaris-demo");
        expect(packageJson.dependencies).toEqual({
            ...template.dependencies,
            ...testPluginDependencies,
        });
        expect(packageJson.devDependencies).toEqual(template.devDependencies);
        for (const file of [
            "vite.config.ts",
            "tsconfig.json",
            "src/generated/plugins.ts",
        ]) {
            expect(await readFile(join(outDir, file), "utf8")).not.toContain(
                ".plugin-store"
            );
        }
        expect(
            await readFile(
                join(outDir, "src", "generated", "plugins.ts"),
                "utf8"
            )
        ).toContain("pluginAliases: Record<string, string> = {}");
        expect(existsSync(join(outDir, "src", "theme", "Layout.tsx"))).toBe(
            true
        );
        expect(existsSync(join(outDir, "package-lock.json"))).toBe(false);
        expect(existsSync(join(outDir, "node_modules"))).toBe(false);

        const install = await runNpm(
            ["install", "--no-audit", "--no-fund"],
            outDir
        );
        expect(install.exitCode, install.stderr).toBe(0);
        const build = await runNpm(["run", "build"], outDir);

        expect(build.exitCode, build.stderr).toBe(0);
        expect(build.stdout).toContain("Prerendered 12 routes");
        const home = await readFile(join(outDir, "dist", "index.html"), "utf8");
        expect(home).toContain("<title>Nefantaris Demo</title>");
        expect(home).toContain("<h1>Welcome</h1>");
        expect(home).toContain('data-template="home"');
        expect(
            existsSync(
                join(outDir, "dist", "blog", "hello-world", "index.html")
            )
        ).toBe(true);
        expect(existsSync(join(outDir, "dist", "404.html"))).toBe(true);
        const installedDateFns = await readPackageJson(
            join(outDir, "node_modules", "date-fns")
        );
        expect(installedDateFns.version).toBe(
            testPluginDependencies["date-fns"]
        );
    });

    test("defaults to <site>/ejected and gitignores it", async () => {
        const root = await makeTempDir("eject-default");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);

        const result = await runNef(["eject", siteDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(existsSync(join(siteDir, "ejected", "package.json"))).toBe(true);
        expect(await readFile(join(siteDir, ".gitignore"), "utf8")).toContain(
            "ejected/"
        );
    });

    test("refuses a non-empty output directory", async () => {
        const root = await makeTempDir("eject-occupied");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);
        const outDir = join(root, "occupied");
        await mkdir(outDir);
        await writeFile(join(outDir, "keep.txt"), "");

        const result = await runNef(["eject", siteDir, "--out", outDir]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(
            `${outDir} already exists and is not empty`
        );
        expect(existsSync(join(outDir, "package.json"))).toBe(false);
    });
});
