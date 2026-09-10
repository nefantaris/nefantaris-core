import { existsSync } from "node:fs";
import { symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadSiteConfig } from "../config.js";
import { parseSiteContent } from "../content/index.js";
import { instantiateSite } from "../instantiate/index.js";
import { templateDir } from "../paths.js";
import { pluginTsconfigPaths, resolvePlugins } from "../plugins/index.js";
import type { ResolvedPlugins } from "../plugins/index.js";
import { pluginStoreDir } from "../plugins/store.js";
import {
    materializeFixtureSite,
    previewNav,
    writeCoveragePages,
} from "./fixtures.js";
import {
    loadThemeManifest,
    themeManifestFileName,
    type ThemeManifest,
} from "./manifest.js";
import { themeWorkDirName, writeThemeTypes } from "./types.js";

export type ThemeWorkspace = {
    themeDir: string;
    workDir: string;
    siteDir: string;
    manifest: ThemeManifest;
    plugins: ResolvedPlugins;
};

const linkThemeNodeModules = async (themeDir: string): Promise<void> => {
    const linkPath = join(themeDir, "node_modules");
    if (existsSync(linkPath)) {
        return;
    }
    await symlink(join(themeWorkDirName, "node_modules"), linkPath, "dir");
};

export const prepareThemeWorkspace = async (
    themeDirArg: string
): Promise<ThemeWorkspace> => {
    const themeDir = resolve(process.cwd(), themeDirArg);
    const manifest = await loadThemeManifest(themeDir);
    const workDir = join(themeDir, themeWorkDirName);
    const plugins = await resolvePlugins({
        siteDir: themeDir,
        storeDir: pluginStoreDir(workDir),
        enabled: [],
        configPath: join(themeDir, themeManifestFileName),
        manifest,
        searchDirs: [themeDir],
        isThemeWorkspace: true,
    });
    const siteDir = await materializeFixtureSite(workDir, manifest);
    const config = await loadSiteConfig(siteDir);
    const parsed = await parseSiteContent(siteDir, config, manifest);
    const coverage = await writeCoveragePages(siteDir, manifest, parsed);
    const isCorpusComplete =
        coverage.templates.length === 0 && coverage.directives.length === 0;
    const content = isCorpusComplete
        ? parsed
        : await parseSiteContent(siteDir, config, manifest);
    await instantiateSite({
        siteDir,
        nefantarisDir: workDir,
        templateDir,
        config: {
            ...config,
            nav: previewNav(config.nav, coverage, content),
        },
        manifest,
        content,
        plugins,
    });
    await writeThemeTypes(themeDir, pluginTsconfigPaths(plugins.aliases));
    await linkThemeNodeModules(themeDir);
    return { themeDir, workDir, siteDir, manifest, plugins };
};
