import { join } from "node:path";
import { prerenderRoutes, runViteBuilds } from "../prerender/index.js";
import { prepareSite } from "./prepareSite.js";

export const runBuild = async (siteDirArg: string): Promise<void> => {
    const { siteDir, nefantarisDir, content } = await prepareSite(siteDirArg);
    const distDir = join(siteDir, "dist");
    await runViteBuilds(nefantarisDir, distDir);
    await prerenderRoutes({ nefantarisDir, distDir, routes: content.routes });
    console.log(
        `Prerendered ${String(content.routes.length)} routes (plus 404.html) to ${distDir}`
    );
};
