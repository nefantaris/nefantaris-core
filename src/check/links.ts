import type { CheckContext, Reference } from "./context.js";
import { finding, type Finding } from "./rules.js";
import { assetsUrlPrefix, localPath, routePathFor } from "./siteFiles.js";

const isRoutedHref = (href: string): boolean =>
    href.startsWith("/") && !href.startsWith(assetsUrlPrefix);

const brokenLinkMessage = (
    { routePaths, files }: CheckContext,
    href: string,
    path: string
): string | undefined => {
    if (routePaths.has(routePathFor(path))) {
        return undefined;
    }
    if (path.startsWith(assetsUrlPrefix)) {
        return files.assetPaths.has(path)
            ? undefined
            : `"${href}" links to a file that is not in assets/.`;
    }
    const isRootFile = files.rootFilePaths.has(path);
    if (!isRoutedHref(href)) {
        return isRootFile
            ? undefined
            : `"${href}" matches no page and no file.`;
    }
    return isRootFile
        ? `"${href}" is a file in public/, but links outside /assets/ open as pages, so clicking it shows the not-found page. Move the file into assets/ and link to /assets/ instead.`
        : `"${href}" matches no page.`;
};

const brokenLinkFinding = (
    context: CheckContext,
    { value, basePath, location }: Reference
): Finding[] => {
    const path = localPath(value, basePath, context.config.url);
    const message =
        path === undefined
            ? undefined
            : brokenLinkMessage(context, value, path);
    return message === undefined
        ? []
        : [finding("links/broken-link", location, message)];
};

export const linkFindings = (context: CheckContext): Finding[] =>
    context.references
        .filter((reference) => reference.kind === "link")
        .flatMap((reference) => brokenLinkFinding(context, reference));
