import { canonicalUrl } from "./siteUrl";
import type { RouteEntry, SiteMeta } from "./types";

const isoDayPattern = /^\d{4}-\d{2}-\d{2}/;

const escapeXml = (value: string): string =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");

const lastModifiedDay = (date: string | undefined): string | undefined => {
    const day = date === undefined ? undefined : isoDayPattern.exec(date)?.[0];
    if (day === undefined || Number.isNaN(Date.parse(day))) {
        return undefined;
    }
    return day;
};

const compareByPath = (first: RouteEntry, second: RouteEntry): number => {
    if (first.path === second.path) {
        return 0;
    }
    return first.path < second.path ? -1 : 1;
};

const sitemapEntry = (siteUrl: string, entry: RouteEntry): string => {
    const location = canonicalUrl(siteUrl, entry.path);
    const day = lastModifiedDay(entry.meta.date);
    return [
        "    <url>",
        `        <loc>${escapeXml(location)}</loc>`,
        ...(day === undefined ? [] : [`        <lastmod>${day}</lastmod>`]),
        "    </url>",
    ].join("\n");
};

export const renderSitemap = (
    site: SiteMeta,
    routes: RouteEntry[]
): string | undefined => {
    const siteUrl = site.url;
    if (siteUrl === undefined) {
        return undefined;
    }
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...routes
            .toSorted(compareByPath)
            .map((entry) => sitemapEntry(siteUrl, entry)),
        "</urlset>",
        "",
    ].join("\n");
};
