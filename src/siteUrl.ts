import { NefantarisError } from "./NefantarisError.js";

const webProtocols = new Set(["http:", "https:"]);

const siteUrlExample = '"https://example.com"';

const imageResolutionBase = "https://example.com";

export const imageReferenceRule =
    'must be a path such as "/assets/cover.webp" or an absolute http or https URL';

const parseUrl = (value: string, base?: string): URL | undefined => {
    try {
        return new URL(value, base);
    } catch {
        return undefined;
    }
};

const isBareOrigin = (url: URL): boolean =>
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "" &&
    url.username === "" &&
    url.password === "";

export const readSiteUrl = (
    value: unknown,
    configPath: string
): string | undefined => {
    if (value === undefined) {
        return undefined;
    }
    const parsed = typeof value === "string" ? parseUrl(value) : undefined;
    if (parsed === undefined || !webProtocols.has(parsed.protocol)) {
        throw new NefantarisError(
            `${configPath}: "url" must be an absolute http or https URL such as ${siteUrlExample}`
        );
    }
    if (!isBareOrigin(parsed)) {
        throw new NefantarisError(
            `${configPath}: "url" must be the address the site is served from, with no path, query, or fragment, such as ${siteUrlExample}`
        );
    }
    return parsed.origin;
};

export const isImageReference = (value: string): boolean => {
    const resolved =
        value === "" ? undefined : parseUrl(value, imageResolutionBase);
    return resolved !== undefined && webProtocols.has(resolved.protocol);
};

export const absoluteSiteUrl = (siteUrl: string, path: string): string =>
    new URL(path, siteUrl).href;
