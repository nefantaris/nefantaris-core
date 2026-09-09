import { join } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { requiredPluginNames, type ThemeManifest } from "../themes/manifest.js";
import { loadPluginManifest, type PluginManifest } from "./manifest.js";
import { pluginNames, type PluginReference } from "./reference.js";
import { resolvePluginDir } from "./resolve.js";
import { installPluginDependencies, pluginPackagePath } from "./store.js";

export type LoadedPlugins = {
    plugins: PluginManifest[];
    dependencies: Record<string, string>;
};

export type ResolvedPlugins = LoadedPlugins & {
    aliases: Record<string, string>;
    roots: string[];
};

type LoadPluginsOptions = {
    siteDir: string;
    enabled: PluginReference[];
    configPath: string;
    manifest: ThemeManifest;
    searchDirs: string[];
    isThemeWorkspace: boolean;
};

type ResolvePluginsOptions = LoadPluginsOptions & { storeDir: string };

const assertRequiresAreEnabled = (
    manifest: ThemeManifest,
    enabled: string[],
    configPath: string
): void => {
    for (const name of requiredPluginNames(manifest)) {
        if (!enabled.includes(name)) {
            throw new NefantarisError(
                `${configPath}: theme "${manifest.name}" requires the plugin "${name}", which is not listed in "plugins" — run: nef plugins add ${name}`
            );
        }
    }
};

const withUnlistedRequirements = (
    enabled: PluginReference[],
    manifest: ThemeManifest
): PluginReference[] => {
    const enabledNames = pluginNames(enabled);
    return [
        ...enabled,
        ...manifest.requires.filter(
            (requirement) => !enabledNames.includes(requirement.name)
        ),
    ];
};

const nameMismatchHint = (reference: PluginReference): string =>
    reference.kind === "named"
        ? "the manifest name and the directory name must match"
        : `the manifest name and the "name" the plugin is pinned under must match`;

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
    siteDir,
    enabled,
    configPath,
    manifest,
    searchDirs,
    isThemeWorkspace,
}: LoadPluginsOptions): Promise<LoadedPlugins> => {
    if (!isThemeWorkspace) {
        assertRequiresAreEnabled(manifest, pluginNames(enabled), configPath);
    }
    const plugins: PluginManifest[] = [];
    for (const reference of withUnlistedRequirements(enabled, manifest)) {
        const pluginDir = await resolvePluginDir(
            siteDir,
            reference,
            searchDirs
        );
        const plugin = await loadPluginManifest(pluginDir);
        if (plugin.name !== reference.name) {
            throw new NefantarisError(
                `${join(pluginDir, "plugin.json")}: "name" is "${plugin.name}" but the plugin was enabled as "${reference.name}" — ${nameMismatchHint(reference)}`
            );
        }
        plugins.push(plugin);
    }
    return { plugins, dependencies: mergeDependencies(plugins) };
};

const storeAliases = (
    storeDir: string,
    dependencies: Record<string, string>
): Record<string, string> =>
    Object.fromEntries(
        Object.keys(dependencies)
            .sort()
            .map((packageName) => [
                packageName,
                pluginPackagePath(storeDir, packageName),
            ])
    );

export const resolvePlugins = async ({
    storeDir,
    ...options
}: ResolvePluginsOptions): Promise<ResolvedPlugins> => {
    const loaded = await loadPlugins(options);
    await installPluginDependencies(storeDir, loaded.dependencies);
    const aliases = storeAliases(storeDir, loaded.dependencies);
    const roots = Object.keys(aliases).length === 0 ? [] : [storeDir];
    return { ...loaded, aliases, roots };
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
