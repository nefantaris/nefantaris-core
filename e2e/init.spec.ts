import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runNef } from "./commands";
import { makeTempDir, testThemeDir } from "./tempSite";

const readJsonName = async (filePath: string): Promise<unknown> =>
    (JSON.parse(await readFile(filePath, "utf8")) as { name: unknown }).name;

test.describe("nef init", () => {
    test("names the site after its folder by default", async () => {
        const siteDir = join(await makeTempDir("init-default"), "field-notes");

        const result = await runNef(["init", siteDir, "--theme", testThemeDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(await readJsonName(join(siteDir, "nefantaris.json"))).toBe(
            "field-notes"
        );
        expect(await readJsonName(join(siteDir, "package.json"))).toBe(
            "field-notes"
        );
    });

    test("names the site from --name", async () => {
        const siteDir = join(await makeTempDir("init-named"), "field-notes");

        const result = await runNef([
            "init",
            siteDir,
            "--theme",
            testThemeDir,
            "--name",
            "  Adam's Field Notes ",
        ]);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.stdout).toContain(
            `Created a Nefantaris site at ${siteDir} (Adam's Field Notes).`
        );
        expect(await readJsonName(join(siteDir, "nefantaris.json"))).toBe(
            "Adam's Field Notes"
        );
        expect(await readJsonName(join(siteDir, "package.json"))).toBe(
            "adam-s-field-notes"
        );
    });

    test("rejects a blank --name before creating anything", async () => {
        const siteDir = join(await makeTempDir("init-blank-name"), "site");

        const result = await runNef([
            "init",
            siteDir,
            "--theme",
            testThemeDir,
            "--name",
            "   ",
        ]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("--name needs a site name");
        expect(existsSync(siteDir)).toBe(false);
    });
});
