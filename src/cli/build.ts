import { join } from "node:path";
import { checkSite, formatReport } from "../check/index.js";
import { runCommand } from "../run.js";
import { prepareSite } from "./prepareSite.js";

const siteBuildScript = join("scripts", "build.mjs");

export const runBuild = async (siteDirArg: string): Promise<void> => {
    const { siteDir, nefantarisDir, config, manifest, content } =
        await prepareSite(siteDirArg);
    await runCommand(
        process.execPath,
        [siteBuildScript, join(siteDir, "dist")],
        nefantarisDir
    );
    const report = await checkSite({ siteDir, config, manifest, content });
    if (report.findings.length > 0) {
        console.warn(
            `\nWarnings from nef doctor (the build is unaffected):\n\n${formatReport(report)}`
        );
    }
};
