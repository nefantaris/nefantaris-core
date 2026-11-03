import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { isPublished } from "../instantiate/sitePublic.js";
import { templateDir } from "../paths.js";
import { collectThemeFiles, withExtensions } from "../themes/files.js";

export const assetsUrlPrefix = "/assets/";

export type SiteFiles = {
    assetPaths: Set<string>;
    rootFilePaths: Set<string>;
};

const resolutionOrigin = "https://nefantaris.invalid";

const generatedRootFiles = ["robots.txt"];

const urlOnlyRootFiles = ["sitemap.xml"];

const themeCodeExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".css"];

const publicTextExtensions = [
    ".css",
    ".html",
    ".js",
    ".json",
    ".svg",
    ".txt",
    ".webmanifest",
    ".xml",
];

const publicTextNames = new Set(["_headers", "_redirects"]);

const assetReferencePattern = /\/assets\/[^\s"'`()<>[\]{},;?#]+/g;

const toPosix = (path: string): string => path.split(sep).join("/");

export const sitePath = (siteDir: string, filePath: string): string =>
    toPosix(relative(siteDir, filePath));

const listFiles = async (dir: string): Promise<string[]> => {
    if (!existsSync(dir)) {
        return [];
    }
    const entries = await readdir(dir, {
        recursive: true,
        withFileTypes: true,
    });
    return entries
        .filter((entry) => entry.isFile())
        .map((entry) =>
            toPosix(relative(dir, join(entry.parentPath, entry.name)))
        )
        .sort();
};

export const isServedPath = (path: string): boolean =>
    path.split("/").every((segment) => isPublished(segment));

export const loadSiteFiles = async (
    siteDir: string,
    siteUrl: string | undefined
): Promise<SiteFiles> => {
    const assets = await listFiles(join(siteDir, "assets"));
    const sitePublic = await listFiles(join(siteDir, "public"));
    const templatePublic = await listFiles(join(templateDir, "public"));
    const generated =
        siteUrl === undefined
            ? generatedRootFiles
            : [...generatedRootFiles, ...urlOnlyRootFiles];
    return {
        assetPaths: new Set(assets.map((path) => `${assetsUrlPrefix}${path}`)),
        rootFilePaths: new Set(
            [
                ...templatePublic,
                ...generated,
                ...sitePublic.filter(isServedPath),
            ].map((path) => `/${path}`)
        ),
    };
};

const decodePath = (pathname: string): string => {
    try {
        return decodeURIComponent(pathname);
    } catch {
        return pathname;
    }
};

export const routeDirectory = (routePath: string): string =>
    routePath === "/" ? "/" : `${routePath}/`;

export const localPath = (
    reference: string,
    basePath: string,
    siteUrl: string | undefined
): string | undefined => {
    if (
        reference === "" ||
        reference.startsWith("#") ||
        reference.startsWith("?")
    ) {
        return undefined;
    }
    let url: URL;
    try {
        url = new URL(reference, `${resolutionOrigin}${basePath}`);
    } catch {
        return undefined;
    }
    if (url.origin !== resolutionOrigin && url.origin !== siteUrl) {
        return undefined;
    }
    return decodePath(url.pathname);
};

export const routePathFor = (path: string): string =>
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

const isPublicTextFile = (path: string): boolean =>
    publicTextExtensions.includes(extname(path).toLowerCase()) ||
    publicTextNames.has(path.split("/").at(-1) ?? "");

const referencesIn = async (files: string[]): Promise<string[]> => {
    const references: string[] = [];
    for (const file of files) {
        const text = await readFile(file, "utf8");
        for (const match of text.matchAll(assetReferencePattern)) {
            references.push(decodePath(match[0]));
        }
    }
    return references;
};

export const assetReferencesOutsideContent = async (
    siteDir: string,
    themeDir: string
): Promise<string[]> => {
    const childThemeDir = join(siteDir, "child-theme");
    const publicDir = join(siteDir, "public");
    const themeFiles = withExtensions(
        await collectThemeFiles(themeDir),
        themeCodeExtensions
    ).map((file) => join(themeDir, file));
    const childThemeFiles = existsSync(childThemeDir)
        ? withExtensions(
              await collectThemeFiles(childThemeDir),
              themeCodeExtensions
          ).map((file) => join(childThemeDir, file))
        : [];
    const publicFiles = (await listFiles(publicDir))
        .filter(isPublicTextFile)
        .map((file) => join(publicDir, file));
    return referencesIn([...themeFiles, ...childThemeFiles, ...publicFiles]);
};
