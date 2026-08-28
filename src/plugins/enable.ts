import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readManifestObject } from "../manifest.js";
import { NefantarisError } from "../NefantarisError.js";
import { resolvePluginDir } from "./index.js";
import { loadPluginManifest } from "./manifest.js";

export const enablePlugin = async (
    siteDir: string,
    name: string
): Promise<void> => {
    const configPath = join(siteDir, "nefantaris.json");
    const config = await readManifestObject(
        configPath,
        `No nefantaris.json found in ${siteDir}`
    );
    const existing = config.plugins;
    if (existing !== undefined && !Array.isArray(existing)) {
        throw new NefantarisError(
            `${configPath}: "plugins" must be an array of plugin names`
        );
    }
    const plugins: unknown[] = existing ?? [];
    if (plugins.includes(name)) {
        console.log(`${configPath} already enables "${name}"`);
        return;
    }
    const plugin = await loadPluginManifest(resolvePluginDir(name, [siteDir]));
    const updated = { ...config, plugins: [...plugins, plugin.name] };
    await writeFile(configPath, `${JSON.stringify(updated, null, 4)}\n`);
    console.log(`Added "${plugin.name}" to ${configPath}`);
};
