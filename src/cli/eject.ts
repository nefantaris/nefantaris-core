import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseSiteContent } from "../content/index.js";
import { ejectSite } from "../instantiate/eject.js";
import { ensureSiteGitignore } from "../instantiate/index.js";
import { NefantarisError } from "../NefantarisError.js";
import { templateDir } from "../paths.js";
import { loadPlugins } from "../plugins/index.js";
import { packageNameFrom } from "./packageName.js";
import { loadSiteManifest } from "./prepareSite.js";

const defaultEjectDirName = "ejected";

export const runEject = async (
    siteDirArg: string,
    outDirArg?: string
): Promise<void> => {
    const siteDir = resolve(process.cwd(), siteDirArg);
    const isDefaultOutDir = outDirArg === undefined;
    const outDir =
        outDirArg === undefined
            ? join(siteDir, defaultEjectDirName)
            : resolve(process.cwd(), outDirArg);
    if (existsSync(outDir) && readdirSync(outDir).length > 0) {
        throw new NefantarisError(`${outDir} already exists and is not empty`);
    }
    const { config, manifest } = await loadSiteManifest(siteDir);
    const plugins = await loadPlugins({
        siteDir,
        enabled: config.plugins,
        configPath: config.configPath,
        manifest,
        searchDirs: [siteDir, manifest.themeDir],
        isThemeWorkspace: false,
    });
    const content = await parseSiteContent(siteDir, config, manifest);
    await ejectSite({
        siteDir,
        outDir,
        templateDir,
        packageName: packageNameFrom(config.name),
        config,
        manifest,
        content,
        plugins,
    });
    if (isDefaultOutDir) {
        await ensureSiteGitignore(siteDir, [defaultEjectDirName]);
    }
    console.log(`Ejected "${config.name}" to ${outDir}`);
    console.log(
        'Run "npm install" and then "npm run build" inside it — it no longer needs Nefantaris.'
    );
};
