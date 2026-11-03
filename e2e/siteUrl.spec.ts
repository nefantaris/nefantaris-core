import { expect, test } from "@playwright/test";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runNef } from "./commands";
import { prerenderedRoutes, siteName } from "./fixtureSite";
import {
    amendJsonFile,
    makeTempDir,
    testThemeDir,
    writeTempSite,
} from "./tempSite";

const localTheme = { source: testThemeDir, version: "local" };

const configuredUrl = "https://Example.com/";
const siteUrl = "https://example.com";
const siteImage = "/og.png";
const postImage = "/assets/photo-teal.webp";

const dollarPage = `---
title: "Prices in $& and $' and $$"
description: Replacement patterns survive prerendering.
---

Literal $& and $$ survive.
`;

const ownSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>
`;

const headMeta = (
    attribute: "name" | "property",
    key: string,
    content: string
): string =>
    `<meta ${attribute}="${key}" content="${content}" data-nefantaris-head />`;

const canonicalLink = (href: string): string =>
    `<link rel="canonical" href="${href}" data-nefantaris-head />`;

const canonicalUrl = (path: string): string =>
    path === "/" ? `${siteUrl}/` : `${siteUrl}${path}/`;

const writeUrlSite = async (label: string): Promise<string> => {
    const siteDir = join(await makeTempDir(label), "site");
    await writeTempSite(siteDir, localTheme);
    await amendJsonFile(join(siteDir, "nefantaris.json"), {
        url: configuredUrl,
        image: siteImage,
    });
    return siteDir;
};

const addPostImage = async (siteDir: string): Promise<void> => {
    const postPath = join(siteDir, "content", "posts", "hello-world.md");
    const post = await readFile(postPath, "utf8");
    await writeFile(
        postPath,
        post.replace("\n---\n", `\nimage: ${postImage}\n---\n`)
    );
};

const readDist = (siteDir: string, file: string): Promise<string> =>
    readFile(join(siteDir, "dist", file), "utf8");

const sitemapLocations = (sitemap: string): string[] =>
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

test.describe("site url", () => {
    test("adds canonical, Open Graph images, a sitemap, and a robots Sitemap line", async () => {
        test.setTimeout(240_000);
        const siteDir = await writeUrlSite("site-url");
        await rm(join(siteDir, "public", "robots.txt"));
        await addPostImage(siteDir);
        await writeFile(
            join(siteDir, "content", "pages", "dollars.md"),
            dollarPage
        );

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        const home = await readDist(siteDir, "index.html");
        for (const tag of [
            canonicalLink(`${siteUrl}/`),
            headMeta("property", "og:url", `${siteUrl}/`),
            headMeta("property", "og:type", "website"),
            headMeta("property", "og:image", `${siteUrl}${siteImage}`),
            headMeta("name", "twitter:card", "summary_large_image"),
            headMeta("name", "twitter:image", `${siteUrl}${siteImage}`),
        ]) {
            expect(home).toContain(tag);
        }

        const post = await readDist(siteDir, "blog/hello-world/index.html");
        const postUrl = canonicalUrl("/blog/hello-world");
        for (const tag of [
            canonicalLink(postUrl),
            headMeta("property", "og:url", postUrl),
            headMeta("property", "og:type", "article"),
            headMeta("property", "og:image", `${siteUrl}${postImage}`),
            headMeta("name", "twitter:image", `${siteUrl}${postImage}`),
        ]) {
            expect(post).toContain(tag);
        }

        const notFound = await readDist(siteDir, "404.html");
        expect(notFound).toContain(headMeta("name", "robots", "noindex"));
        for (const absent of ["canonical", "og:url", "og:image", siteUrl]) {
            expect(notFound).not.toContain(absent);
        }

        const sitemap = await readDist(siteDir, "sitemap.xml");
        const routePaths = [
            ...prerenderedRoutes.map((route) => route.path),
            "/dollars",
        ].sort();
        expect(sitemapLocations(sitemap)).toEqual(
            routePaths.map((path) => canonicalUrl(path))
        );
        expect(sitemap).toContain(
            `<loc>${postUrl}</loc>\n        <lastmod>2026-08-10</lastmod>`
        );
        expect(sitemap).toContain(
            `<loc>${canonicalUrl("/about")}</loc>\n    </url>`
        );
        expect(sitemap).not.toContain("draft");
        expect(sitemap).not.toContain("not_found");

        expect(await readDist(siteDir, "robots.txt")).toBe(
            `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`
        );

        const dollars = await readDist(siteDir, "dollars/index.html");
        expect(dollars).toContain(
            `<title>Prices in $&amp; and $' and $$ — ${siteName}</title>`
        );
        expect(dollars).toContain("Literal $&amp; and $$ survive.");
    });

    test("a site's own robots.txt and sitemap.xml win over the generated ones", async () => {
        test.setTimeout(240_000);
        const siteDir = await writeUrlSite("site-url-own-files");
        await writeFile(join(siteDir, "public", "sitemap.xml"), ownSitemap);

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode, result.stderr).toBe(0);
        const robots = await readDist(siteDir, "robots.txt");
        expect(robots).toContain("Disallow: /hidden-draft");
        expect(robots).not.toContain("Sitemap:");
        expect(await readDist(siteDir, "sitemap.xml")).toBe(ownSitemap);
        expect(await readDist(siteDir, "index.html")).toContain(
            canonicalLink(`${siteUrl}/`)
        );
    });

    test("nef inspect --json reports the normalised url and the image", async () => {
        const siteDir = await writeUrlSite("site-url-inspect");

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode, result.stderr).toBe(0);
        const inspection: unknown = JSON.parse(result.stdout);
        expect(inspection).toMatchObject({
            site: { name: siteName, url: siteUrl, image: siteImage },
        });
    });

    test("nef inspect --json leaves url and image out when unset", async () => {
        const siteDir = join(await makeTempDir("site-url-unset"), "site");
        await writeTempSite(siteDir, localTheme);

        const result = await runNef(["inspect", siteDir, "--json"]);

        expect(result.exitCode, result.stderr).toBe(0);
        const inspection: unknown = JSON.parse(result.stdout);
        expect(inspection).toHaveProperty("site.name", siteName);
        expect(inspection).not.toHaveProperty("site.url");
        expect(inspection).not.toHaveProperty("site.image");
    });

    for (const url of [
        "example.com",
        "ftp://example.com",
        "https://example.com/blog",
        "https://example.com/?ref=1",
    ]) {
        test(`rejects ${url} as the site url`, async () => {
            const siteDir = await writeUrlSite("site-url-invalid");
            const configPath = join(siteDir, "nefantaris.json");
            await amendJsonFile(configPath, { url });

            const result = await runNef(["inspect", siteDir, "--json"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain(`${configPath}: "url" must`);
        });
    }

    test("rejects a page image that cannot resolve to a web url", async () => {
        const siteDir = await writeUrlSite("site-url-bad-image");
        const pagePath = join(siteDir, "content", "pages", "about.md");
        const page = await readFile(pagePath, "utf8");
        await writeFile(
            pagePath,
            page.replace(
                "\n---\n",
                '\nimage: "mailto:someone@example.com"\n---\n'
            )
        );

        const result = await runNef(["build", siteDir]);

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain(`${pagePath}: frontmatter "image"`);
    });
});
