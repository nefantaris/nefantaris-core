import { join, resolve } from "node:path";
import { loadSiteConfig, type SiteConfig } from "../config.js";
import { parseSiteContent, type SiteContent } from "../content/index.js";
import { instantiateSite } from "../instantiate/index.js";
import { templateDir } from "../paths.js";
import { resolvePlugins } from "../plugins/index.js";
import { loadThemeManifest, type ThemeManifest } from "../themes/manifest.js";

export type PreparedSite = {
    siteDir: string;
    nefantarisDir: string;
    config: SiteConfig;
    manifest: ThemeManifest;
    content: SiteContent;
};

export const prepareSite = async (
    siteDirArg: string
): Promise<PreparedSite> => {
    const siteDir = resolve(process.cwd(), siteDirArg);
    const nefantarisDir = join(siteDir, ".nefantaris");
    const config = await loadSiteConfig(siteDir);
    const manifest = await loadThemeManifest(
        resolve(siteDir, config.themeSource)
    );
    const plugins = await resolvePlugins({
        enabled: config.plugins,
        configPath: config.configPath,
        manifest,
        searchDirs: [siteDir, manifest.themeDir],
        isThemeWorkspace: false,
    });
    const content = await parseSiteContent(siteDir, manifest);
    await instantiateSite({
        siteDir,
        nefantarisDir,
        templateDir,
        config,
        manifest,
        content,
        plugins,
    });
    return { siteDir, nefantarisDir, config, manifest, content };
};
