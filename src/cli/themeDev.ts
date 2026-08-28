import { watch, type FSWatcher } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { viteBinPath } from "../prerender/index.js";
import { runCommand } from "../run.js";
import { isSkippedThemeEntry } from "../themes/files.js";
import { installTheme } from "../themes/index.js";
import { prepareThemeWorkspace } from "../themes/workspace.js";

const watchThemeSources = async (
    themeDir: string,
    onChange: () => void
): Promise<FSWatcher[]> => {
    const entries = await readdir(themeDir, { withFileTypes: true });
    return entries
        .filter((entry) => !isSkippedThemeEntry(entry.name))
        .map((entry) =>
            watch(
                join(themeDir, entry.name),
                { recursive: entry.isDirectory() },
                onChange
            )
        );
};

export const runThemeDev = async (
    themeDirArg: string,
    viteArgs: string[]
): Promise<void> => {
    const { themeDir, workDir, siteDir, manifest } =
        await prepareThemeWorkspace(themeDirArg);

    let reinstallTimer: NodeJS.Timeout | undefined;
    const watchers = await watchThemeSources(themeDir, () => {
        clearTimeout(reinstallTimer);
        reinstallTimer = setTimeout(() => {
            void installTheme({ siteDir, nefantarisDir: workDir, manifest });
        }, 100);
    });

    console.log(
        `Previewing theme "${manifest.name}" against the Nefantaris fixture corpus`
    );
    try {
        await runCommand(viteBinPath(workDir), viteArgs, workDir);
    } finally {
        for (const watcher of watchers) {
            watcher.close();
        }
    }
};
