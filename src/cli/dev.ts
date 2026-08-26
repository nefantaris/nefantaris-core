import { watch } from "node:fs";
import { join, resolve } from "node:path";
import { loadSiteConfig } from "../config.js";
import { parseSiteContent } from "../content/index.js";
import { NefantarisError } from "../NefantarisError.js";
import {
    instantiateSite,
    writeGeneratedContent,
} from "../instantiate/index.js";
import { templateDir } from "../paths.js";
import { viteBinPath } from "../prerender/index.js";
import { runCommand } from "../run.js";

export const runDev = async (
    siteDirArg: string,
    viteArgs: string[]
): Promise<void> => {
    const siteDir = resolve(process.cwd(), siteDirArg);
    const nefantarisDir = join(siteDir, ".nefantaris");
    const config = await loadSiteConfig(siteDir);
    const content = await parseSiteContent(siteDir);
    await instantiateSite({
        siteDir,
        nefantarisDir,
        templateDir,
        config,
        content,
    });

    const regenerate = async (): Promise<void> => {
        try {
            const updated = await parseSiteContent(siteDir);
            await writeGeneratedContent(nefantarisDir, config, updated);
        } catch (error) {
            if (error instanceof NefantarisError) {
                console.error(error.message);
                return;
            }
            throw error;
        }
    };

    let regenerateTimer: NodeJS.Timeout | undefined;
    const watcher = watch(join(siteDir, "content"), { recursive: true }, () => {
        clearTimeout(regenerateTimer);
        regenerateTimer = setTimeout(() => void regenerate(), 100);
    });

    try {
        await runCommand(viteBinPath(nefantarisDir), viteArgs, nefantarisDir);
    } finally {
        watcher.close();
    }
};
