import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import type { CheckContext, Reference } from "./context.js";
import { imageSize } from "./imageSize.js";
import { finding, type Finding } from "./rules.js";
import { assetsUrlPrefix, isServedPath, localPath } from "./siteFiles.js";

export const imageLimits = { bytes: 300 * 1024, longestEdge: 2400 };

const imageExtensions = new Set([
    ".avif",
    ".bmp",
    ".gif",
    ".jpeg",
    ".jpg",
    ".png",
    ".svg",
    ".webp",
]);

const nonWebpImagePattern = /\.(png|jpe?g|gif|bmp)$/i;

const measuredExtensions = new Set([".gif", ".jpeg", ".jpg", ".png", ".webp"]);

const missingImageMessage = (
    { files }: CheckContext,
    reference: string,
    path: string
): string | undefined => {
    if (path.startsWith(assetsUrlPrefix)) {
        return files.assetPaths.has(path)
            ? undefined
            : `Image "${reference}" is not in assets/.`;
    }
    return files.rootFilePaths.has(path)
        ? undefined
        : `Image "${reference}" matches no file in assets/ or public/.`;
};

const missingImageFinding = (
    context: CheckContext,
    { value, basePath, location }: Reference
): Finding[] => {
    const path = localPath(value, basePath, context.config.url);
    const message =
        path === undefined
            ? undefined
            : missingImageMessage(context, value, path);
    return message === undefined
        ? []
        : [finding("images/missing-file", location, message)];
};

const kilobytes = (bytes: number): string =>
    `${String(Math.round(bytes / 1024))} KB`;

const notWebpFindings = (assetPath: string): Finding[] =>
    nonWebpImagePattern.test(assetPath)
        ? [
              finding(
                  "images/not-webp",
                  { file: assetPath.slice(1) },
                  `Image "${assetPath}" is not WebP. Convert it at https://tools.sturge.dev/webp`
              ),
          ]
        : [];

const largeFileFindings = async (
    assetPath: string,
    filePath: string
): Promise<Finding[]> => {
    const { size } = await stat(filePath);
    return size > imageLimits.bytes
        ? [
              finding(
                  "images/large-file",
                  { file: assetPath.slice(1) },
                  `Image "${assetPath}" is ${kilobytes(size)}; keep images under ${kilobytes(imageLimits.bytes)} so pages load quickly.`
              ),
          ]
        : [];
};

const largeDimensionFindings = async (
    assetPath: string,
    filePath: string
): Promise<Finding[]> => {
    if (!measuredExtensions.has(extname(assetPath).toLowerCase())) {
        return [];
    }
    const dimensions = imageSize(await readFile(filePath));
    if (
        dimensions === undefined ||
        Math.max(dimensions.width, dimensions.height) <= imageLimits.longestEdge
    ) {
        return [];
    }
    return [
        finding(
            "images/large-dimensions",
            { file: assetPath.slice(1) },
            `Image "${assetPath}" is ${String(dimensions.width)}×${String(dimensions.height)} pixels; resize it so neither side is over ${String(imageLimits.longestEdge)}.`
        ),
    ];
};

const assetFileFindings = async (
    { siteDir }: CheckContext,
    assetPath: string
): Promise<Finding[]> => {
    if (!imageExtensions.has(extname(assetPath).toLowerCase())) {
        return [];
    }
    const filePath = join(siteDir, assetPath);
    return [
        ...notWebpFindings(assetPath),
        ...(await largeFileFindings(assetPath, filePath)),
        ...(await largeDimensionFindings(assetPath, filePath)),
    ];
};

const referencedAssetPaths = (context: CheckContext): Set<string> =>
    new Set([
        ...context.assetReferencesOutsideContent,
        ...context.references.flatMap(({ value, basePath }) => {
            const path = localPath(value, basePath, context.config.url);
            return path === undefined ? [] : [path];
        }),
    ]);

const servedAssetPaths = (context: CheckContext): string[] =>
    [...context.files.assetPaths].filter((path) =>
        isServedPath(path.slice(assetsUrlPrefix.length))
    );

const unreferencedAssetFindings = (context: CheckContext): Finding[] => {
    const referenced = referencedAssetPaths(context);
    return servedAssetPaths(context)
        .filter((path) => !referenced.has(path))
        .map((path) =>
            finding(
                "images/unreferenced-asset",
                { file: path.slice(1) },
                `Nothing links to "${path}", but it is still published with the site. Remove it if it is no longer needed.`
            )
        );
};

export const imageFindings = async (
    context: CheckContext
): Promise<Finding[]> => {
    const fileFindings: Finding[] = [];
    for (const assetPath of servedAssetPaths(context)) {
        fileFindings.push(...(await assetFileFindings(context, assetPath)));
    }
    return [
        ...context.references
            .filter((reference) => reference.kind === "image")
            .flatMap((reference) => missingImageFinding(context, reference)),
        ...fileFindings,
        ...unreferencedAssetFindings(context),
    ];
};
