import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NefantarisError } from "../NefantarisError.js";

type InstallThemeOptions = {
    siteDir: string;
    nefantarisDir: string;
    themeSource: string;
};

export const installTheme = async ({
    siteDir,
    nefantarisDir,
    themeSource,
}: InstallThemeOptions): Promise<void> => {
    const themeDir = resolve(siteDir, themeSource);
    const themeSrcDir = join(themeDir, "src", "theme");
    if (!existsSync(themeSrcDir)) {
        throw new NefantarisError(
            `Theme source "${themeSource}" (resolved to ${themeDir}) has no src/theme directory`
        );
    }
    for (const required of ["index.ts", "theme.css"]) {
        if (!existsSync(join(themeSrcDir, required))) {
            throw new NefantarisError(
                `Theme at ${themeDir} is missing src/theme/${required}`
            );
        }
    }
    const target = join(nefantarisDir, "src", "theme");
    await rm(target, { recursive: true, force: true });
    await cp(themeSrcDir, target, { recursive: true });
    const childThemeDir = join(siteDir, "child-theme");
    if (existsSync(childThemeDir)) {
        await cp(childThemeDir, target, { recursive: true, force: true });
    }
};
