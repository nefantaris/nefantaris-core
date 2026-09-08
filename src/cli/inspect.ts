import { resolve } from "node:path";
import type { NavItem } from "../config.js";
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
};

export const runInspect = async (siteDirArg: string): Promise<void> => {
    const siteDir = resolve(process.cwd(), siteDirArg);
    const { config, manifest } = await loadSiteManifest(siteDir);
    const inspection: SiteInspection = {
        contract: 1,
        site: {
            name: config.name,
            nav: config.nav,
            plugins: config.plugins,
        },
        templates: Object.keys(manifest.templates),
        directives: Object.keys(manifest.directives),
        plugins: config.plugins,
    };
    console.log(JSON.stringify(inspection, null, 4));
};
