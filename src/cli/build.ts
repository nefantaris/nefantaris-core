import { join, resolve } from "node:path";
import { loadSiteConfig } from "../config.js";
import { parseSiteContent } from "../content/index.js";
import { instantiateSite } from "../instantiate/index.js";
import { templateDir } from "../paths.js";
import { prerenderRoutes, runViteBuilds } from "../prerender/index.js";

export const runBuild = async (siteDirArg: string): Promise<void> => {
    const siteDir = resolve(process.cwd(), siteDirArg);
    const nefantarisDir = join(siteDir, ".nefantaris");
    const distDir = join(siteDir, "dist");
    const config = await loadSiteConfig(siteDir);
    const content = await parseSiteContent(siteDir);
    await instantiateSite({
        siteDir,
        nefantarisDir,
        templateDir,
        config,
        content,
    });
    await runViteBuilds(nefantarisDir, distDir);
    await prerenderRoutes({ nefantarisDir, distDir, routes: content.routes });
    console.log(
        `Prerendered ${String(content.routes.length)} routes (plus 404.html) to ${distDir}`
    );
};
