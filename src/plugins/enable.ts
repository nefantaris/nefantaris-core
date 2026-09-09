import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readManifestObject } from "../manifest.js";
import { NefantarisError } from "../NefantarisError.js";
import type { SourceReferenceLabels } from "../sources/reference.js";
import { loadPluginManifest } from "./manifest.js";
import {
    pluginConfigEntry,
    pluginNames,
    pluginReferenceFrom,
    readPluginReferences,
    type PluginReference,
} from "./reference.js";
import { resolvePluginDir } from "./resolve.js";

const addLabels: SourceReferenceLabels = {
    prefix: "",
    source: "--source",
    version: "--version",
};

const referenceFromFlags = (
    name: string,
    sourceArg: string | undefined,
    versionArg: string | undefined
): PluginReference => {
    if (sourceArg !== undefined) {
        return pluginReferenceFrom(name, sourceArg, versionArg, addLabels);
    }
    if (versionArg !== undefined) {
        throw new NefantarisError(
            `--version needs --source — pass the git URL the plugin is fetched from as well`
        );
    }
    return { kind: "named", name };
};

export const enablePlugin = async (
    siteDir: string,
    name: string,
    sourceArg?: string,
    versionArg?: string
): Promise<void> => {
    const configPath = join(siteDir, "nefantaris.json");
    const config = await readManifestObject(
        configPath,
        `No nefantaris.json found in ${siteDir}`
    );
    const existing = readPluginReferences(config, "plugins", configPath);
    if (pluginNames(existing).includes(name)) {
        console.log(`${configPath} already enables "${name}"`);
        return;
    }
    const reference = referenceFromFlags(name, sourceArg, versionArg);
    const plugin = await loadPluginManifest(
        await resolvePluginDir(siteDir, reference, [siteDir])
    );
    if (plugin.name !== name) {
        throw new NefantarisError(
            `${join(plugin.pluginDir, "plugin.json")}: "name" is "${plugin.name}" but the plugin was enabled as "${name}" — pass the manifest name to nef plugins add`
        );
    }
    const plugins = Array.isArray(config.plugins) ? config.plugins : [];
    const updated = {
        ...config,
        plugins: [...plugins, pluginConfigEntry(reference)],
    };
    await writeFile(configPath, `${JSON.stringify(updated, null, 4)}\n`);
    console.log(`Added "${plugin.name}" to ${configPath}`);
};
