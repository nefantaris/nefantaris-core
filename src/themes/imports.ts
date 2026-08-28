import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { baselinePackages } from "../plugins/manifest.js";
import { contractModuleName } from "./types.js";

export type UndeclaredImport = {
    file: string;
    specifier: string;
    packageName: string;
};

const specifierPatterns = [
    /(?:^|[\s;}])(?:import|export)\s[\s\S]*?\bfrom\s*(["'])([^"']+)\1/g,
    /(?:^|[\s;}])import\s*(["'])([^"']+)\1/g,
    /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g,
];

const isRelative = (specifier: string): boolean =>
    specifier.startsWith(".") || specifier.startsWith("/");

const packageNameOf = (specifier: string): string => {
    const segments = specifier.split("/");
    return specifier.startsWith("@")
        ? segments.slice(0, 2).join("/")
        : (segments[0] ?? specifier);
};

const specifiersIn = (source: string): string[] => {
    const specifiers = new Set<string>();
    for (const pattern of specifierPatterns) {
        for (const match of source.matchAll(pattern)) {
            const specifier = match[2];
            if (specifier !== undefined) {
                specifiers.add(specifier);
            }
        }
    }
    return [...specifiers];
};

export const findUndeclaredImports = async (
    themeDir: string,
    sourceFiles: string[],
    pluginPackages: string[]
): Promise<UndeclaredImport[]> => {
    const allowed = new Set([
        contractModuleName,
        ...baselinePackages,
        ...pluginPackages,
    ]);
    const undeclared: UndeclaredImport[] = [];
    for (const file of sourceFiles) {
        const source = await readFile(join(themeDir, file), "utf8");
        for (const specifier of specifiersIn(source)) {
            if (isRelative(specifier)) {
                continue;
            }
            const packageName = packageNameOf(specifier);
            if (allowed.has(packageName)) {
                continue;
            }
            undeclared.push({ file, specifier, packageName });
        }
    }
    return undeclared;
};

export const assertNoUndeclaredImports = (
    manifest: { name: string },
    undeclared: UndeclaredImport[]
): void => {
    if (undeclared.length === 0) {
        return;
    }
    const lines = undeclared.map(
        ({ file, specifier, packageName }) =>
            `    ${file} imports "${specifier}" — nothing provides "${packageName}"`
    );
    const missing = [
        ...new Set(undeclared.map((entry) => entry.packageName)),
    ].sort();
    throw new NefantarisError(
        `Theme "${manifest.name}" imports packages it has not declared:\n${lines.join(
            "\n"
        )}\nThe baseline is ${baselinePackages.join(", ")}. Add a plugin providing ${missing
            .map((name) => `"${name}"`)
            .join(", ")} and list it in "requires" in theme.json.`
    );
};
