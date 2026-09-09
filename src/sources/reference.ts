import { NefantarisError } from "../NefantarisError.js";

export type SourceReference =
    | { kind: "local"; path: string }
    | { kind: "git"; url: string; version: string };

export type SourceReferenceLabels = {
    prefix: string;
    source: string;
    version: string;
};

export type SourceConfigEntry = { source: string; version: string };

export const localVersion = "local";

const urlSchemePattern = /^[a-z][a-z0-9+.-]*:\/\//i;
const scpLikePattern = /^[^\s/@-][^\s/@]*@[^\s/:]+:/;
const refNamePattern = /^[^\s-]\S*$/;

export const isGitSource = (source: string): boolean =>
    urlSchemePattern.test(source) || scpLikePattern.test(source);

export const sourceReferenceFrom = (
    source: string,
    version: string | undefined,
    labels: SourceReferenceLabels
): SourceReference => {
    if (!isGitSource(source)) {
        if (version !== undefined && version !== localVersion) {
            throw new NefantarisError(
                `${labels.prefix}${labels.version} must be "${localVersion}" when ${labels.source} is a path — to pin a version, point ${labels.source} at a git URL`
            );
        }
        return { kind: "local", path: source };
    }
    if (version === undefined || version === localVersion) {
        throw new NefantarisError(
            `${labels.prefix}${labels.version} is required when ${labels.source} is a git URL — pin a tag such as "v1.0.0" or a full commit SHA`
        );
    }
    if (!refNamePattern.test(version)) {
        throw new NefantarisError(
            `${labels.prefix}${labels.version} is "${version}", which is not a tag name or a commit SHA`
        );
    }
    return { kind: "git", url: source, version };
};

export const manifestLabels = (
    key: string,
    manifestPath: string
): SourceReferenceLabels => ({
    prefix: `${manifestPath}: `,
    source: `"${key}.source"`,
    version: `"${key}.version"`,
});

export const readSourceReference = (
    value: Record<string, unknown>,
    key: string,
    manifestPath: string
): SourceReference => {
    const { source, version } = value;
    if (typeof source !== "string" || source === "") {
        throw new NefantarisError(
            `${manifestPath}: "${key}.source" must be a non-empty string`
        );
    }
    if (
        version !== undefined &&
        (typeof version !== "string" || version === "")
    ) {
        throw new NefantarisError(
            `${manifestPath}: "${key}.version" must be a non-empty string`
        );
    }
    return sourceReferenceFrom(
        source,
        version,
        manifestLabels(key, manifestPath)
    );
};

export const sourceConfigEntry = (
    reference: SourceReference
): SourceConfigEntry =>
    reference.kind === "local"
        ? { source: reference.path, version: localVersion }
        : { source: reference.url, version: reference.version };
