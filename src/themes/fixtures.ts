import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { NavItem } from "../config.js";
import type { SiteContent } from "../content/index.js";
import { isRecord } from "../narrow.js";
import { fixtureSiteDir } from "../paths.js";
import { pluginConfigEntry } from "../plugins/reference.js";
import { selectableTemplateNames, type ThemeManifest } from "./manifest.js";

const fixtureWorkDirName = "fixture";
const notFoundPreviewPath = "/nefantaris-not-found-preview";

const copiedFixtureEntries = ["content", "assets", "nefantaris.json"];
const blockDirectivePattern = /^:{2,3}([A-Za-z][A-Za-z0-9-]*)/gm;

export type FixtureCoverage = {
    templates: string[];
    directives: string[];
};

const templateRoute = (templateName: string): string =>
    `/templates/${templateName}`;

const directiveRoute = (directiveName: string): string =>
    `/directives/${directiveName}`;

type CoverageSection = {
    path: string;
    title: string;
    order?: number;
    body: (templateRoutePath: string) => string;
};

const templateIndexOrder = 10;

const coverageSections: CoverageSection[] = [
    {
        path: "guide/first-steps",
        title: "First steps",
        order: templateIndexOrder + 1,
        body: (templateRoutePath) =>
            `The route list a theme receives is sorted by authored \`order\`
first and by path second, so this page precedes
[Going further](${templateRoutePath}/guide/going-further) even though its path
sorts after it.`,
    },
    {
        path: "guide/going-further",
        title: "Going further",
        order: templateIndexOrder + 2,
        body: (templateRoutePath) =>
            `A sidebar built from \`routes\` groups these pages by path
segment, and prev/next links follow the same list. Back to
[First steps](${templateRoutePath}/guide/first-steps).`,
    },
    {
        path: "reference/content-nodes",
        title: "Content nodes",
        body: () =>
            `This page declares no \`order\`, so it falls into the alphabetical
tail behind every page that does. The [markdown reference](/markdown) renders
the full node set.`,
    },
    {
        path: "reference/route-data",
        title: "Route data",
        body: () =>
            `Every route reaches a theme as a \`RouteSummary\` carrying its
path, title, resolved template, and authored \`order\` when the page declares
one.`,
    },
];

const frontmatterOrder = (order: number | undefined): string =>
    order === undefined ? "" : `order: ${String(order)}\n`;

const templatePageSource = (templateName: string): string =>
    `---
title: ${templateName} template
description: Generated preview page for the "${templateName}" template.
template: ${templateName}
${frontmatterOrder(templateIndexOrder)}---

Core generated this page because the fixture corpus does not otherwise reach
the **${templateName}** template. It opens a small nested set of pages, so a
sidebar built from \`routes\` has grouping and a prev/next chain to show. Read
the [markdown reference](/markdown) for the full set of nodes a template has
to style.
`;

const sectionPageSource = (
    templateName: string,
    section: CoverageSection
): string =>
    `---
title: ${section.title}
description: Generated preview page nested under the "${templateName}" template.
template: ${templateName}
${frontmatterOrder(section.order)}---

${section.body(templateRoute(templateName))}
`;

const directivePageSource = (directiveName: string): string =>
    `---
title: ${directiveName} directive
description: Generated preview page for the "${directiveName}" directive.
---

Core generated this page because the fixture corpus does not otherwise use the
**${directiveName}** directive declared in theme.json.

:::${directiveName}
![A teal placeholder](/assets/photo-teal.webp)

![An amber placeholder](/assets/photo-amber.webp)
:::
`;

const writeFixtureConfig = async (
    siteDir: string,
    manifest: ThemeManifest
): Promise<void> => {
    const configPath = join(siteDir, "nefantaris.json");
    const parsed: unknown = JSON.parse(await readFile(configPath, "utf8"));
    const config = isRecord(parsed) ? parsed : {};
    const updated = {
        ...config,
        theme: { source: manifest.themeDir, version: "local" },
        plugins: manifest.requires.map(pluginConfigEntry),
    };
    await writeFile(configPath, `${JSON.stringify(updated, null, 4)}\n`);
};

const markdownFilesIn = async (contentDir: string): Promise<string[]> => {
    const entries = await readdir(contentDir, {
        recursive: true,
        withFileTypes: true,
    });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => join(entry.parentPath, entry.name));
};

const directiveNamesIn = (source: string): string[] => [
    ...new Set(
        [...source.matchAll(blockDirectivePattern)].flatMap((match) =>
            match[1] === undefined ? [] : [match[1]]
        )
    ),
];

const removePagesUsingUndeclaredDirectives = async (
    siteDir: string,
    manifest: ThemeManifest
): Promise<void> => {
    for (const filePath of await markdownFilesIn(join(siteDir, "content"))) {
        const used = directiveNamesIn(await readFile(filePath, "utf8"));
        const isSupported = used.every(
            (name) => manifest.directives[name] !== undefined
        );
        if (!isSupported) {
            await rm(filePath);
        }
    }
};

export const materializeFixtureSite = async (
    workDir: string,
    manifest: ThemeManifest
): Promise<string> => {
    const siteDir = join(workDir, fixtureWorkDirName);
    await rm(siteDir, { recursive: true, force: true });
    await mkdir(siteDir, { recursive: true });
    for (const entry of copiedFixtureEntries) {
        await cp(join(fixtureSiteDir, entry), join(siteDir, entry), {
            recursive: true,
        });
    }
    await writeFile(join(siteDir, ".gitignore"), ".nefantaris/\ndist/\n");
    await writeFixtureConfig(siteDir, manifest);
    await removePagesUsingUndeclaredDirectives(siteDir, manifest);
    return siteDir;
};

const writePage = async (
    siteDir: string,
    relativePath: string,
    source: string
): Promise<void> => {
    const filePath = join(siteDir, "content", "pages", relativePath);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, source);
};

export const writeCoveragePages = async (
    siteDir: string,
    manifest: ThemeManifest,
    content: SiteContent
): Promise<FixtureCoverage> => {
    const coveredTemplates = new Set(
        content.routes.map((route) => route.template)
    );
    const templates = selectableTemplateNames(manifest).filter(
        (name) => !coveredTemplates.has(name)
    );
    for (const templateName of templates) {
        await writePage(
            siteDir,
            join("templates", `${templateName}.md`),
            templatePageSource(templateName)
        );
        for (const section of coverageSections) {
            await writePage(
                siteDir,
                join("templates", templateName, `${section.path}.md`),
                sectionPageSource(templateName, section)
            );
        }
    }
    const coveredDirectives = new Set<string>();
    for (const filePath of await markdownFilesIn(join(siteDir, "content"))) {
        for (const name of directiveNamesIn(await readFile(filePath, "utf8"))) {
            coveredDirectives.add(name);
        }
    }
    const directives = Object.keys(manifest.directives)
        .filter((name) => !coveredDirectives.has(name))
        .sort();
    for (const directiveName of directives) {
        await writePage(
            siteDir,
            join("directives", `${directiveName}.md`),
            directivePageSource(directiveName)
        );
    }
    return { templates, directives };
};

const isRouteHref = (href: string): boolean =>
    href.startsWith("/") && !href.startsWith("/assets/");

const withReachableRoutes = (
    nav: NavItem[],
    routePaths: Set<string>
): NavItem[] =>
    nav.flatMap((item) => {
        const children =
            item.children === undefined
                ? []
                : withReachableRoutes(item.children, routePaths);
        const isReachable =
            !isRouteHref(item.href) || routePaths.has(item.href);
        if (!isReachable && children.length === 0) {
            return [];
        }
        const reachable: NavItem = { label: item.label, href: item.href };
        if (children.length > 0) {
            reachable.children = children;
        }
        return [reachable];
    });

export const previewNav = (
    nav: NavItem[],
    coverage: FixtureCoverage,
    content: SiteContent
): NavItem[] => [
    ...withReachableRoutes(
        nav,
        new Set(content.routes.map((route) => route.path))
    ),
    ...coverage.templates.map((templateName) => ({
        label: `${templateName} template`,
        href: templateRoute(templateName),
        children: coverageSections.map((section) => ({
            label: section.title,
            href: `${templateRoute(templateName)}/${section.path}`,
        })),
    })),
    ...coverage.directives.map((directiveName) => ({
        label: `${directiveName} directive`,
        href: directiveRoute(directiveName),
    })),
    { label: "404 preview", href: notFoundPreviewPath },
];
