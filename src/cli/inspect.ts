import { resolve } from "node:path";
import type { NavItem } from "../config.js";
import { resolveModes, type ModeSettings } from "../modes.js";
import { pluginNames } from "../plugins/reference.js";
import { loadSiteManifest } from "./prepareSite.js";

export type SiteInspection = {
    contract: number;
    site: {
        name: string;
        nav: NavItem[];
        plugins: string[];
    };
    templates: string[];
    directives: string[];
    plugins: string[];
    modes: ModeSettings;
};

export const runInspect = async (siteDirArg: string): Promise<void> => {
    const siteDir = resolve(process.cwd(), siteDirArg);
    const { config, manifest } = await loadSiteManifest(siteDir);
    const plugins = pluginNames(config.plugins);
    const inspection: SiteInspection = {
        contract: 1,
        site: {
            name: config.name,
            nav: config.nav,
            plugins,
        },
        templates: Object.keys(manifest.templates),
        directives: Object.keys(manifest.directives),
        plugins,
        modes: resolveModes(config, manifest),
    };
    console.log(JSON.stringify(inspection, null, 4));
};
