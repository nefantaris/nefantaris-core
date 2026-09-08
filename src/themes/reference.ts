import { NefantarisError } from "../NefantarisError.js";

export type ThemeReference =
    | { kind: "local"; path: string }
    | { kind: "git"; url: string; version: string };

export type ThemeReferenceLabels = {
    prefix: string;
    source: string;
    version: string;
};

export const localThemeVersion = "local";

const urlSchemePattern = /^[a-z][a-z0-9+.-]*:\/\//i;
const scpLikePattern = /^[^\s/@-][^\s/@]*@[^\s/:]+:/;
const refNamePattern = /^[^\s-]\S*$/;

export const isGitSource = (source: string): boolean =>
    urlSchemePattern.test(source) || scpLikePattern.test(source);

export const themeReferenceFrom = (
    source: string,
    version: string | undefined,
    labels: ThemeReferenceLabels
): ThemeReference => {
    if (!isGitSource(source)) {
        if (version !== undefined && version !== localThemeVersion) {
            throw new NefantarisError(
                `${labels.prefix}${labels.version} must be "${localThemeVersion}" when ${labels.source} is a path — to pin a version, point ${labels.source} at a git URL`
            );
        }
        return { kind: "local", path: source };
    }
    if (version === undefined || version === localThemeVersion) {
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
