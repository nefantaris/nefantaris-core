import { expect, test } from "@playwright/test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runNef } from "./commands";
import { makeTempDir, testThemeDir, writeTempSite } from "./tempSite";

const localTheme = { source: testThemeDir, version: "local" };

test.describe("site public files", () => {
    test("refuses public/assets", async () => {
        const root = await makeTempDir("public-assets");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);
        const publicAssetsDir = join(siteDir, "public", "assets");
        await mkdir(publicAssetsDir, { recursive: true });
        await writeFile(join(publicAssetsDir, "x.txt"), "");

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(publicAssetsDir);
        expect(result.stderr).toContain(join(siteDir, "assets"));
    });

    test("refuses public/index.html", async () => {
        const root = await makeTempDir("public-index");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);
        const publicIndexPath = join(siteDir, "public", "index.html");
        await writeFile(publicIndexPath, "<!doctype html>");

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(publicIndexPath);
    });

    test("picks the first available favicon by precedence", async () => {
        test.setTimeout(240_000);
        const root = await makeTempDir("public-favicon");
        const siteDir = join(root, "site");
        await writeTempSite(siteDir, localTheme);
        const publicDir = join(siteDir, "public");
        await rm(join(publicDir, "favicon.png"));
        await writeFile(join(publicDir, "favicon.ico"), "ico");
        await writeFile(join(publicDir, "favicon.webp"), "webp");

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(
            await readFile(join(siteDir, "dist", "index.html"), "utf8")
        ).toContain(
            '<link rel="icon" type="image/webp" href="/favicon.webp" />'
        );
    });
});
