import { watch } from "node:fs";
import { join } from "node:path";
import { parseSiteContent } from "../content/index.js";
import { writeGeneratedContent } from "../instantiate/index.js";
import { NefantarisError } from "../NefantarisError.js";
import { viteBinPath } from "../prerender/index.js";
import { runCommand } from "../run.js";
import { prepareSite } from "./prepareSite.js";

export const runDev = async (
    siteDirArg: string,
    viteArgs: string[]
): Promise<void> => {
    const { siteDir, nefantarisDir, config, manifest } =
        await prepareSite(siteDirArg);

    const regenerate = async (): Promise<void> => {
        try {
            const updated = await parseSiteContent(siteDir, manifest);
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
