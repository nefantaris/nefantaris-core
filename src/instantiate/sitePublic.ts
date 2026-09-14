import { existsSync } from "node:fs";
import { cp, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { NefantarisError } from "../NefantarisError.js";

type Favicon = {
    fileName: string;
    type: string;
};

const unpublishedEntries = new Set(["README.md", ".gitkeep", ".DS_Store"]);

const templateFaviconName = "favicon.svg";

const faviconCandidates: Favicon[] = [
    { fileName: templateFaviconName, type: "image/svg+xml" },
    { fileName: "favicon.png", type: "image/png" },
    { fileName: "favicon.webp", type: "image/webp" },
    { fileName: "favicon.ico", type: "image/x-icon" },
];

const iconLinkPattern = /<link rel="icon"[^>]*>/;

const sitePublicDir = (siteDir: string): string => join(siteDir, "public");

const isPublished = (source: string): boolean =>
    !unpublishedEntries.has(basename(source));

const iconLink = ({ fileName, type }: Favicon): string =>
    `<link rel="icon" type="${type}" href="/${fileName}" />`;

const rejectReservedEntries = (siteDir: string, publicDir: string): void => {
    const publicAssetsPath = join(publicDir, "assets");
    if (existsSync(publicAssetsPath)) {
        const assetsDir = join(siteDir, "assets");
        throw new NefantarisError(
            [
                `${publicAssetsPath} is reserved.`,
                `Files served at /assets/ belong in ${assetsDir}.`,
            ].join(" ")
        );
    }
    const publicIndexPath = join(publicDir, "index.html");
    if (existsSync(publicIndexPath)) {
        const homePageSource = join(siteDir, "content", "pages", "index.md");
        throw new NefantarisError(
            [
                `${publicIndexPath} would replace the generated home page,`,
                `which comes from ${homePageSource}.`,
            ].join(" ")
        );
    }
};

export const copySitePublic = async (
    siteDir: string,
    nefantarisDir: string
): Promise<void> => {
    const publicDir = sitePublicDir(siteDir);
    if (!existsSync(publicDir)) {
        return;
    }
    rejectReservedEntries(siteDir, publicDir);
    await cp(publicDir, join(nefantarisDir, "public"), {
        recursive: true,
        force: true,
        filter: isPublished,
    });
};

export const writeSiteFavicon = async (
    siteDir: string,
    nefantarisDir: string
): Promise<void> => {
    const publicDir = sitePublicDir(siteDir);
    const favicon = faviconCandidates.find(({ fileName }) =>
        existsSync(join(publicDir, fileName))
    );
    if (favicon === undefined || favicon.fileName === templateFaviconName) {
        return;
    }
    const indexHtmlPath = join(nefantarisDir, "index.html");
    const html = await readFile(indexHtmlPath, "utf8");
    if (!iconLinkPattern.test(html)) {
        throw new NefantarisError(
            [
                `${indexHtmlPath} has no <link rel="icon">`,
                `to point at /${favicon.fileName}`,
            ].join(" ")
        );
    }
    await writeFile(
        indexHtmlPath,
        html.replace(iconLinkPattern, iconLink(favicon))
    );
};
