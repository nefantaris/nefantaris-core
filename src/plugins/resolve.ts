import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { packageRoot } from "../paths.js";
import { resolveSourceDir, type SnapshotKind } from "../sources/snapshot.js";
import type { PluginReference } from "./reference.js";

const pluginSnapshots = (name: string): SnapshotKind => ({
    noun: "plugin",
    cacheDirName: "plugins",
    versionLabel: `the version pinned for plugin "${name}"`,
});

const pluginSearchPaths = (name: string, searchDirs: string[]): string[] => {
    const candidates = searchDirs.flatMap((dir) => [
        join(dir, "plugins", name),
        join(dir, "node_modules", name),
        join(dirname(dir), name),
    ]);
    candidates.push(join(packageRoot, "node_modules", name));
    return [...new Set(candidates)];
};

const findNamedPluginDir = (name: string, searchDirs: string[]): string => {
    const candidates = pluginSearchPaths(name, searchDirs);
    const found = candidates.find((candidate) => existsSync(candidate));
    if (found === undefined) {
        throw new NefantarisError(
            `Plugin "${name}" was not found. Nefantaris looked in:\n${candidates
                .map((candidate) => `    ${candidate}`)
                .join("\n")}`
        );
    }
    return found;
};

export const resolvePluginDir = (
    siteDir: string,
    reference: PluginReference,
    searchDirs: string[]
): Promise<string> =>
    reference.kind === "named"
        ? Promise.resolve(findNamedPluginDir(reference.name, searchDirs))
        : resolveSourceDir(siteDir, reference, pluginSnapshots(reference.name));
