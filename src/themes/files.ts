import { readdir } from "node:fs/promises";
import { join } from "node:path";

const skippedThemeNames = new Set([
    "node_modules",
    "tsconfig.json",
    "README.md",
    "BRIEF.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
]);

export const isSkippedThemeEntry = (name: string): boolean =>
    name.startsWith(".") || skippedThemeNames.has(name);

const collectFrom = async (
    themeDir: string,
    relativeDir: string
): Promise<string[]> => {
    const entries = await readdir(join(themeDir, relativeDir), {
        withFileTypes: true,
    });
    const files: string[] = [];
    for (const entry of entries) {
        if (isSkippedThemeEntry(entry.name)) {
            continue;
        }
        const path =
            relativeDir === "" ? entry.name : `${relativeDir}/${entry.name}`;
        if (entry.isDirectory()) {
            files.push(...(await collectFrom(themeDir, path)));
            continue;
        }
        if (entry.isFile()) {
            files.push(path);
        }
    }
    return files;
};

export const collectThemeFiles = async (themeDir: string): Promise<string[]> =>
    (await collectFrom(themeDir, "")).sort();

export const withExtensions = (
    files: string[],
    extensions: string[]
): string[] =>
    files.filter((file) =>
        extensions.some((extension) => file.endsWith(extension))
    );
