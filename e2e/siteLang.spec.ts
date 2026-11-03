import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runNef } from "./commands";
import { fixtureSiteDir } from "./fixtureSite";
import {
    amendJsonFile,
    makeTempDir,
    testThemeDir,
    writeTempSite,
} from "./tempSite";

const localTheme = { source: testThemeDir, version: "local" };

const brokenLinkPage = `---
title: Broken
description: A page with a link to nowhere, which the build reports and survives.
---

See [the missing page](/nowhere).
`;

const writeLangSite = async (
    label: string,
    lang: string
): Promise<{ root: string; siteDir: string }> => {
    const root = await makeTempDir(label);
    const siteDir = join(root, "site");
    await writeTempSite(siteDir, localTheme);
    await amendJsonFile(join(siteDir, "nefantaris.json"), { lang });
    return { root, siteDir };
};

const htmlOpenTag = (lang: string): string =>
    `<html lang="${lang}" data-modes="light dark" data-default-mode="system">`;

test.describe("site lang", () => {
    test("reaches the html tag in build and eject, and the build only warns about doctor findings", async () => {
        test.setTimeout(240_000);
        const { root, siteDir } = await writeLangSite("site-lang", "fr-ca");
        await writeFile(
            join(siteDir, "content", "pages", "broken.md"),
            brokenLinkPage
        );
        const outDir = join(root, "ejected");

        const build = await runNef(["build", siteDir]);
        const eject = await runNef(["eject", siteDir, "--out", outDir]);

        expect(build.exitCode, build.stderr).toBe(0);
        expect(build.stderr).toContain("[links/broken-link]");
        for (const file of ["index.html", "about/index.html", "404.html"]) {
            expect(
                await readFile(join(siteDir, "dist", file), "utf8")
            ).toContain(htmlOpenTag("fr-CA"));
        }
        expect(eject.exitCode, eject.stderr).toBe(0);
        expect(await readFile(join(outDir, "index.html"), "utf8")).toContain(
            htmlOpenTag("fr-CA")
        );
    });

    test("nef inspect --json reports the canonical lang only when one is set", async () => {
        const { siteDir } = await writeLangSite("site-lang-inspect", "PT-br");

        const withLang = await runNef(["inspect", siteDir, "--json"]);
        const withoutLang = await runNef(["inspect", fixtureSiteDir, "--json"]);

        expect(withLang.exitCode, withLang.stderr).toBe(0);
        const inspection: unknown = JSON.parse(withLang.stdout);
        expect(inspection).toHaveProperty("site.lang", "pt-BR");
        expect(withoutLang.exitCode, withoutLang.stderr).toBe(0);
        const fixtureInspection: unknown = JSON.parse(withoutLang.stdout);
        expect(fixtureInspection).not.toHaveProperty("site.lang");
    });

    for (const lang of ["english please", "en_US", ""]) {
        test(`rejects ${JSON.stringify(lang)} as the site lang`, async () => {
            const { siteDir } = await writeLangSite("site-lang-invalid", lang);

            const result = await runNef(["inspect", siteDir, "--json"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain(
                `${join(siteDir, "nefantaris.json")}: "lang" must`
            );
        });
    }
});
