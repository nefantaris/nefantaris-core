const canonicalPath = (routePath: string): string =>
    routePath === "/" ? routePath : `${routePath}/`;

export const absoluteSiteUrl = (siteUrl: string, path: string): string =>
    new URL(path, siteUrl).href;

export const canonicalUrl = (siteUrl: string, routePath: string): string =>
    absoluteSiteUrl(siteUrl, canonicalPath(routePath));
