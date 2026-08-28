import { statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
    assertContractVersion,
    assertKnownKeys,
    readComponentMap,
    readContainedPath,
    readManifestName,
    readManifestObject,
} from "../manifest.js";
import { NefantarisError } from "../NefantarisError.js";
import { isRecord } from "../narrow.js";

export const pluginManifestFileName = "plugin.json";
export const baselinePackages = ["react", "react-dom", "wouter"];

const providesKeys = ["dependencies", "directives", "hooks", "functions"];
const packageNamePattern =
    /^(?:@[a-z0-9-][a-z0-9._-]*\/)?[a-z0-9-][a-z0-9._-]*$/;
const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export type PluginManifest = {
    pluginDir: string;
    name: string;
    dependencies: Record<string, string>;
    directives: Record<string, string>;
    hooks: string | undefined;
    functions: string | undefined;
};

const readProvides = (
    source: Record<string, unknown>,
    manifestPath: string
): Record<string, unknown> => {
    const { provides } = source;
    if (provides === undefined) {
        return {};
    }
    if (!isRecord(provides)) {
        throw new NefantarisError(
            `${manifestPath}: "provides" must be an object`
        );
    }
    assertKnownKeys(provides, "provides", providesKeys, manifestPath);
    return provides;
};

const readDependencies = (
    provides: Record<string, unknown>,
    manifestPath: string
): Record<string, string> => {
    const value = provides.dependencies;
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        throw new NefantarisError(
            `${manifestPath}: "provides.dependencies" must be an object mapping package names to exact versions`
        );
    }
    const dependencies: Record<string, string> = {};
    for (const [packageName, version] of Object.entries(value)) {
        const key = `provides.dependencies.${packageName}`;
        if (!packageNamePattern.test(packageName)) {
            throw new NefantarisError(
                `${manifestPath}: "${key}" is not a valid npm package name`
            );
        }
        if (baselinePackages.includes(packageName)) {
            throw new NefantarisError(
                `${manifestPath}: "${key}" is a baseline package — ${baselinePackages.join(", ")} come from the site template and must not be declared by a plugin`
            );
        }
        if (typeof version !== "string" || !exactVersionPattern.test(version)) {
            throw new NefantarisError(
                `${manifestPath}: "${key}" must be an exact version such as "4.1.0", not a range`
            );
        }
        dependencies[packageName] = version;
    }
    return dependencies;
};

const readEntryPath = (
    provides: Record<string, unknown>,
    key: "hooks" | "functions",
    expectsDirectory: boolean,
    manifestPath: string,
    pluginDir: string
): string | undefined => {
    const value = provides[key];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string" || value === "") {
        throw new NefantarisError(
            `${manifestPath}: "provides.${key}" must be a non-empty string`
        );
    }
    const entryPath = readContainedPath(
        value,
        `provides.${key}`,
        manifestPath,
        pluginDir
    );
    const isDirectory = statSync(resolve(pluginDir, entryPath)).isDirectory();
    if (expectsDirectory !== isDirectory) {
        throw new NefantarisError(
            `${manifestPath}: "provides.${key}" is "${value}", which must be a ${expectsDirectory ? "directory" : "file"}`
        );
    }
    return entryPath;
};

export const loadPluginManifest = async (
    pluginDir: string
): Promise<PluginManifest> => {
    const manifestPath = join(pluginDir, pluginManifestFileName);
    const parsed = await readManifestObject(
        manifestPath,
        `No ${pluginManifestFileName} found in ${pluginDir}`
    );
    const name = readManifestName(parsed, manifestPath);
    assertContractVersion(parsed, manifestPath);
    const provides = readProvides(parsed, manifestPath);
    return {
        pluginDir,
        name,
        dependencies: readDependencies(provides, manifestPath),
        directives: readComponentMap(
            provides.directives,
            "provides.directives",
            manifestPath,
            pluginDir
        ),
        hooks: readEntryPath(provides, "hooks", false, manifestPath, pluginDir),
        functions: readEntryPath(
            provides,
            "functions",
            true,
            manifestPath,
            pluginDir
        ),
    };
};
