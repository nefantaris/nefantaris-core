import { resolve } from "node:path";
import {
    checkSite,
    configFileName,
    doctorReport,
    formatReport,
    parseFailureFinding,
    type DoctorReport,
} from "../check/index.js";
import { parseSiteContent, type SiteContent } from "../content/index.js";
import { loadSiteManifest, type LoadedSiteManifest } from "./prepareSite.js";

const contentDirName = "content";

const doctorSite = async (siteDir: string): Promise<DoctorReport> => {
    let loaded: LoadedSiteManifest;
    try {
        loaded = await loadSiteManifest(siteDir);
    } catch (error) {
        return doctorReport([
            parseFailureFinding(error, siteDir, { file: configFileName }),
        ]);
    }
    let content: SiteContent;
    try {
        content = await parseSiteContent(
            siteDir,
            loaded.config,
            loaded.manifest
        );
    } catch (error) {
        return doctorReport([
            parseFailureFinding(error, siteDir, { file: contentDirName }),
        ]);
    }
    return checkSite({ siteDir, ...loaded, content });
};

export const runDoctor = async (
    siteDirArg: string,
    isJson: boolean
): Promise<void> => {
    const report = await doctorSite(resolve(process.cwd(), siteDirArg));
    console.log(
        isJson ? JSON.stringify(report, null, 4) : formatReport(report)
    );
    if (report.errors > 0) {
        process.exitCode = 1;
    }
};
