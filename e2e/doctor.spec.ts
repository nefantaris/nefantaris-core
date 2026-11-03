import { expect, test } from "@playwright/test";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isRecord } from "../src/narrow.js";
import { runNef, type CommandResult } from "./commands";
import { fixtureSiteDir, navLinks, siteName } from "./fixtureSite";
import {
    amendJsonFile,
    makeTempDir,
    testThemeDir,
    writeTempSite,
} from "./tempSite";

const localTheme = { source: testThemeDir, version: "local" };

const siteUrl = "https://example.com";

const fixtureAdvice = [
    "advice meta/description-short content/pages/about.md description",
    "advice meta/description-short content/pages/gallery.md description",
    "advice meta/description-short content/posts/hello-world.md description",
    "advice meta/description-short content/posts/why-markdown.md description",
    "advice meta/no-og-image nefantaris.json image",
    "advice meta/no-url nefantaris.json url",
];

const linksPage = `---
title: Links
description: A page whose links and images exercise every way nef doctor resolves a reference.
image: /missing-share.png
---

Pages: [about](/about/), [how it works](/about#how-it-works),
[the markdown reference](/markdown?ref=links), [the gallery](../gallery),
[the robots file](${siteUrl}/robots.txt), [the squares](/assets/squares.svg),
[an outside site](https://example.org/docs), [mail](mailto:hi@example.com),
and [the top](#top).

Broken: [a missing page](/nowhere), [a missing file](/assets/gone.pdf),
[a public file routed as a page](/favicon.png),
[a relative miss](nowhere-else), and [a same-site miss](${siteUrl}/nope).

![The site icon](/favicon.png)
![The template icon](/favicon.svg)
![A missing asset](/assets/missing.webp)
![A missing public file](/missing.png)
`;

const advicePage = `---
title: Advice
---

#### Skipped straight to four

## Back to two

![](/assets/squares.svg)

Avoid [click here](/about), [Read more →](/markdown), and [](/gallery).

![Huge](/assets/huge.png)
![Wide](/assets/wide.jpg)
![Tall](/assets/tall.gif)
![Lossy](/assets/lossy.webp)
![Lossless](/assets/lossless.webp)
![Extended](/assets/extended.webp)
![Heavy](/assets/heavy.webp)
![Fine](/assets/fine.webp)
`;

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const png = (width: number, height: number): Buffer => {
    const buffer = Buffer.alloc(33);
    Buffer.from(pngSignature).copy(buffer, 0);
    buffer.writeUInt32BE(13, 8);
    buffer.write("IHDR", 12, "latin1");
    buffer.writeUInt32BE(width, 16);
    buffer.writeUInt32BE(height, 20);
    return buffer;
};

const jpeg = (width: number, height: number): Buffer => {
    const frame = Buffer.alloc(19);
    frame.writeUInt16BE(0xffc0, 0);
    frame.writeUInt16BE(17, 2);
    frame.writeUInt8(8, 4);
    frame.writeUInt16BE(height, 5);
    frame.writeUInt16BE(width, 7);
    const app0 = Buffer.alloc(18);
    app0.writeUInt16BE(0xffe0, 0);
    app0.writeUInt16BE(16, 2);
    app0.write("JFIF", 4, "latin1");
    return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, frame]);
};

const gif = (width: number, height: number): Buffer => {
    const buffer = Buffer.alloc(13);
    buffer.write("GIF89a", 0, "latin1");
    buffer.writeUInt16LE(width, 6);
    buffer.writeUInt16LE(height, 8);
    return buffer;
};

const webp = (chunk: string, payload: Buffer): Buffer => {
    const header = Buffer.alloc(20);
    header.write("RIFF", 0, "latin1");
    header.writeUInt32LE(12 + payload.length, 4);
    header.write("WEBP", 8, "latin1");
    header.write(chunk, 12, "latin1");
    header.writeUInt32LE(payload.length, 16);
    return Buffer.concat([header, payload]);
};

const lossyWebp = (width: number, height: number): Buffer => {
    const payload = Buffer.alloc(10);
    payload.set([0x9d, 0x01, 0x2a], 3);
    payload.writeUInt16LE(width, 6);
    payload.writeUInt16LE(height, 8);
    return webp("VP8 ", payload);
};

const losslessWebp = (width: number, height: number): Buffer => {
    const payload = Buffer.alloc(5);
    payload.writeUInt8(0x2f, 0);
    payload.writeUInt32LE((width - 1) | ((height - 1) << 14), 1);
    return webp("VP8L", payload);
};

const extendedWebp = (width: number, height: number): Buffer => {
    const payload = Buffer.alloc(10);
    payload.writeUIntLE(width - 1, 4, 3);
    payload.writeUIntLE(height - 1, 7, 3);
    return webp("VP8X", payload);
};

const describeFinding = (finding: unknown): string => {
    if (!isRecord(finding)) {
        throw new Error("a finding is not an object");
    }
    const { severity, rule, file, key } = finding;
    return [severity, rule, file, key]
        .filter((part) => part !== undefined)
        .map(String)
        .join(" ");
};

const reportOf = (result: CommandResult): Record<string, unknown> => {
    const report: unknown = JSON.parse(result.stdout);
    if (!isRecord(report)) {
        throw new Error(`nef doctor printed no report: ${result.stderr}`);
    }
    return report;
};

const findingsOf = (result: CommandResult): string[] => {
    const { findings } = reportOf(result);
    if (!Array.isArray(findings)) {
        throw new Error("the report has no findings array");
    }
    return findings.map(describeFinding).sort();
};

const doctorJson = (siteDir: string): Promise<CommandResult> =>
    runNef(["doctor", siteDir, "--json"]);

const writeDoctorSite = async (label: string): Promise<string> => {
    const siteDir = join(await makeTempDir(label), "site");
    await writeTempSite(siteDir, localTheme);
    return siteDir;
};

const writePage = (
    siteDir: string,
    name: string,
    source: string
): Promise<void> =>
    writeFile(join(siteDir, "content", "pages", `${name}.md`), source);

const writeAsset = (
    siteDir: string,
    name: string,
    contents: Buffer | string
): Promise<void> => writeFile(join(siteDir, "assets", name), contents);

test.describe("nef doctor", () => {
    test("finds no errors in the fixture corpus, and only the advice it has earned", async () => {
        const json = await doctorJson(fixtureSiteDir);
        const text = await runNef(["doctor", fixtureSiteDir]);

        expect(json.exitCode, json.stderr).toBe(0);
        expect(reportOf(json)).toMatchObject({
            contract: 1,
            errors: 0,
            advice: fixtureAdvice.length,
        });
        expect(findingsOf(json)).toEqual(fixtureAdvice);
        expect(text.exitCode, text.stderr).toBe(0);
        for (const rule of ["meta/no-url", "meta/description-short"]) {
            expect(text.stdout).toContain(`[${rule}]`);
        }
    });

    test("reports links and images that resolve to nothing as errors", async () => {
        const siteDir = await writeDoctorSite("doctor-errors");
        await amendJsonFile(join(siteDir, "nefantaris.json"), {
            url: siteUrl,
            image: "/assets/missing-cover.webp",
            nav: [
                ...navLinks,
                { label: "Missing", href: "/missing" },
                {
                    label: "Guides",
                    href: "/guides/introduction/",
                    children: [{ label: "Gone", href: "/guides/gone" }],
                },
            ],
        });
        await writePage(siteDir, "links", linksPage);

        const result = await doctorJson(siteDir);

        expect(result.exitCode).toBe(1);
        expect(reportOf(result)).toMatchObject({ contract: 1, errors: 11 });
        expect(
            findingsOf(result).filter((finding) => finding.startsWith("error"))
        ).toEqual([
            "error images/missing-file content/pages/links.md",
            "error images/missing-file content/pages/links.md",
            "error images/missing-file content/pages/links.md image",
            "error images/missing-file nefantaris.json image",
            "error links/broken-link content/pages/links.md",
            "error links/broken-link content/pages/links.md",
            "error links/broken-link content/pages/links.md",
            "error links/broken-link content/pages/links.md",
            "error links/broken-link content/pages/links.md",
            "error links/broken-link nefantaris.json nav[5].href",
            "error links/broken-link nefantaris.json nav[6].children[0].href",
        ]);
        const text = await runNef(["doctor", siteDir]);
        expect(text.exitCode).toBe(1);
        expect(text.stdout).toContain("[links/broken-link]");
    });

    test("gives advice on alt text, headings, link text, descriptions, and asset hygiene", async () => {
        const siteDir = await writeDoctorSite("doctor-advice");
        await amendJsonFile(join(siteDir, "nefantaris.json"), {
            url: siteUrl,
            image: "/favicon.png",
        });
        await writePage(siteDir, "advice", advicePage);
        const postPath = join(siteDir, "content", "posts", "hello-world.md");
        const post = await readFile(postPath, "utf8");
        await writeFile(
            postPath,
            post.replace(
                "The first post on the Nefantaris demo blog.",
                "A".repeat(161)
            )
        );
        await writeAsset(siteDir, "huge.png", png(3000, 20));
        await writeAsset(siteDir, "wide.jpg", jpeg(2500, 400));
        await writeAsset(siteDir, "tall.gif", gif(10, 2600));
        await writeAsset(siteDir, "lossy.webp", lossyWebp(3000, 1000));
        await writeAsset(siteDir, "lossless.webp", losslessWebp(2401, 50));
        await writeAsset(siteDir, "extended.webp", extendedWebp(1000, 4000));
        await writeAsset(
            siteDir,
            "heavy.webp",
            Buffer.concat([extendedWebp(100, 100), Buffer.alloc(300 * 1024)])
        );
        await writeAsset(siteDir, "fine.webp", extendedWebp(2400, 2400));
        await writeAsset(siteDir, "unused.webp", extendedWebp(10, 10));
        await writeAsset(siteDir, "theme-only.webp", extendedWebp(10, 10));
        await writeAsset(siteDir, "redirected.webp", extendedWebp(10, 10));
        await writeAsset(siteDir, ".gitkeep", "");
        await mkdir(join(siteDir, "assets", "notes"));
        await writeAsset(siteDir, join("notes", "README.md"), "Notes\n");
        await mkdir(join(siteDir, "child-theme", "components"), {
            recursive: true,
        });
        await writeFile(
            join(siteDir, "child-theme", "components", "Badge.tsx"),
            'export const badgePath = "/assets/theme-only.webp";\n'
        );
        await appendFile(
            join(siteDir, "public", "_redirects"),
            "/badge.webp /assets/redirected.webp 301\n"
        );

        const result = await doctorJson(siteDir);

        expect(result.exitCode, result.stderr).toBe(0);
        expect(reportOf(result)).toMatchObject({ errors: 0 });
        expect(findingsOf(result)).toEqual([
            "advice a11y/empty-alt content/pages/advice.md",
            "advice a11y/heading-skip content/pages/advice.md",
            "advice a11y/vague-link-text content/pages/advice.md",
            "advice a11y/vague-link-text content/pages/advice.md",
            "advice a11y/vague-link-text content/pages/advice.md",
            "advice images/large-dimensions assets/extended.webp",
            "advice images/large-dimensions assets/huge.png",
            "advice images/large-dimensions assets/lossless.webp",
            "advice images/large-dimensions assets/lossy.webp",
            "advice images/large-dimensions assets/tall.gif",
            "advice images/large-dimensions assets/wide.jpg",
            "advice images/large-file assets/heavy.webp",
            "advice images/not-webp assets/huge.png",
            "advice images/not-webp assets/tall.gif",
            "advice images/not-webp assets/wide.jpg",
            "advice images/unreferenced-asset assets/unused.webp",
            "advice meta/description-long content/posts/hello-world.md description",
            "advice meta/description-missing content/pages/advice.md description",
            "advice meta/description-short content/pages/about.md description",
            "advice meta/description-short content/pages/gallery.md description",
            "advice meta/description-short content/posts/why-markdown.md description",
        ]);
    });

    const parseFailures = [
        {
            name: "a page with no title",
            expected: "error site/parse content/pages/untitled.md title",
            breakSite: (siteDir: string) =>
                writePage(siteDir, "untitled", "---\ndescription: x\n---\n"),
        },
        {
            name: "frontmatter that is not valid YAML",
            expected: "error site/parse content/pages/half-typed.md",
            breakSite: (siteDir: string) =>
                writePage(siteDir, "half-typed", '---\ntitle: "Half\n---\n'),
        },
        {
            name: "a nefantaris.json that is not valid JSON",
            expected: "error site/parse nefantaris.json",
            breakSite: (siteDir: string) =>
                writeFile(join(siteDir, "nefantaris.json"), '{ "name": '),
        },
        {
            name: "an invalid lang",
            expected: "error site/parse nefantaris.json lang",
            breakSite: (siteDir: string) =>
                amendJsonFile(join(siteDir, "nefantaris.json"), {
                    lang: "english please",
                }),
        },
    ];

    for (const { name, expected, breakSite } of parseFailures) {
        test(`reports ${name} as a site/parse finding instead of crashing`, async () => {
            const siteDir = await writeDoctorSite("doctor-parse");
            await breakSite(siteDir);

            const result = await doctorJson(siteDir);

            expect(result.exitCode).toBe(1);
            expect(reportOf(result)).toMatchObject({
                contract: 1,
                errors: 1,
                advice: 0,
            });
            expect(findingsOf(result)).toEqual([expected]);
        });
    }

    test("doctor and inspect take --json without a siteDir", async () => {
        const doctor = await runNef(["doctor", "--json"], fixtureSiteDir);
        const inspect = await runNef(["inspect", "--json"], fixtureSiteDir);
        const inspectWithoutJson = await runNef(["inspect"], fixtureSiteDir);

        expect(doctor.exitCode, doctor.stderr).toBe(0);
        expect(findingsOf(doctor)).toEqual(fixtureAdvice);
        expect(inspect.exitCode, inspect.stderr).toBe(0);
        const inspection: unknown = JSON.parse(inspect.stdout);
        expect(inspection).toHaveProperty("site.name", siteName);
        expect(inspectWithoutJson.exitCode).toBe(1);
        expect(inspectWithoutJson.stderr).toContain("Usage:");
    });
});
