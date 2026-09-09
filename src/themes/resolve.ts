import type { SourceReference } from "../sources/reference.js";
import { resolveSourceDir, type SnapshotKind } from "../sources/snapshot.js";

const themeSnapshots: SnapshotKind = {
    noun: "theme",
    cacheDirName: "themes",
    versionLabel: '"theme.version"',
};

export const resolveThemeDir = (
    siteDir: string,
    theme: SourceReference
): Promise<string> => resolveSourceDir(siteDir, theme, themeSnapshots);
