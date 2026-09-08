import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { packageRoot } from "../paths.js";
import type { ThemeManifest } from "../themes/manifest.js";
import { loadPluginManifest, type PluginManifest } from "./manifest.js";
import { installPluginDependencies, pluginPackagePath } from "./store.js";

export type LoadedPlugins = {
    plugins: PluginManifest[];
    dependencies: Record<string, string>;
};

export type ResolvedPlugins = LoadedPlugins & {
    aliases: Record<string, string>;
};

type LoadPluginsOptions = {
    enabled: string[];
    configPath: string;
    manifest: ThemeManifest;
    searchDirs: string[];
    isThemeWorkspace: boolean;
};

const pluginSearchPaths = (name: string, searchDirs: string[]): string[] => {
    const candidates = searchDirs.flatMap((dir) => [
        join(dir, "plugins", name),
        join(dir, "node_modules", name),
        join(dirname(dir), name),
    ]);
    candidates.push(join(packageRoot, "node_modules", name));
    return [...new Set(candidates)];
};

export const resolvePluginDir = (
    name: string,
    searchDirs: string[]
): string => {
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

const assertRequiresAreEnabled = (
    manifest: ThemeManifest,
    enabled: string[],
    configPath: string
): void => {
    for (const name of manifest.requires) {
        if (!enabled.includes(name)) {
            throw new NefantarisError(
                `${configPath}: theme "${manifest.name}" requires the plugin "${name}", which is not listed in "plugins" — run: nef plugins add ${name}`
            );
        }
    }
};

const mergeDependencies = (
    plugins: PluginManifest[]
): Record<string, string> => {
    const dependencies: Record<string, string> = {};
    const owners: Record<string, string> = {};
    for (const plugin of plugins) {
        for (const [packageName, version] of Object.entries(
            plugin.dependencies
        )) {
            const existing = dependencies[packageName];
            const owner = owners[packageName];
            if (existing !== undefined && existing !== version) {
                throw new NefantarisError(
                    `Plugins disagree on "${packageName}": "${owner}" wants ${existing} and "${plugin.name}" wants ${version} — the enabled plugins must pin the same version`
                );
            }
            dependencies[packageName] = version;
            owners[packageName] = plugin.name;
        }
    }
    return dependencies;
};

export const loadPlugins = async ({
    enabled,
    configPath,
    manifest,
    searchDirs,
    isThemeWorkspace,
}: LoadPluginsOptions): Promise<LoadedPlugins> => {
    if (!isThemeWorkspace) {
        assertRequiresAreEnabled(manifest, enabled, configPath);
    }
    const names = [...new Set([...enabled, ...manifest.requires])];
    const plugins: PluginManifest[] = [];
    for (const name of names) {
        const pluginDir = resolvePluginDir(name, searchDirs);
        const plugin = await loadPluginManifest(pluginDir);
        if (plugin.name !== name) {
            throw new NefantarisError(
                `${join(pluginDir, "plugin.json")}: "name" is "${plugin.name}" but the plugin was enabled as "${name}" — the manifest name and the directory name must match`
            );
        }
        plugins.push(plugin);
    }
    return { plugins, dependencies: mergeDependencies(plugins) };
};

const storeAliases = (
    dependencies: Record<string, string>
): Record<string, string> =>
    Object.fromEntries(
        Object.keys(dependencies)
            .sort()
            .map((packageName) => [packageName, pluginPackagePath(packageName)])
    );

export const resolvePlugins = async (
    options: LoadPluginsOptions
): Promise<ResolvedPlugins> => {
    const loaded = await loadPlugins(options);
    await installPluginDependencies(loaded.dependencies);
    return { ...loaded, aliases: storeAliases(loaded.dependencies) };
};

export const pluginTsconfigPaths = (
    aliases: Record<string, string>
): Record<string, string[]> =>
    Object.fromEntries(
        Object.entries(aliases).flatMap(([packageName, packageDir]) => [
            [packageName, [packageDir]],
            [`${packageName}/*`, [`${packageDir}/*`]],
        ])
    );
