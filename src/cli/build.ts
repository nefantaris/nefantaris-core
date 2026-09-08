import { join } from "node:path";
import { runCommand } from "../run.js";
import { prepareSite } from "./prepareSite.js";

const siteBuildScript = join("scripts", "build.mjs");

export const runBuild = async (siteDirArg: string): Promise<void> => {
    const { siteDir, nefantarisDir } = await prepareSite(siteDirArg);
    await runCommand(
        process.execPath,
        [siteBuildScript, join(siteDir, "dist")],
        nefantarisDir
    );
};
