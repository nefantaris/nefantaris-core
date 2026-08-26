import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NefantarisError } from "./NefantarisError.js";
import { isRecord } from "./narrow.js";

export type SiteConfig = {
    name: string;
    themeSource: string;
};

export const loadSiteConfig = async (siteDir: string): Promise<SiteConfig> => {
    const configPath = join(siteDir, "nefantaris.json");
    let text: string;
    try {
        text = await readFile(configPath, "utf8");
    } catch {
        throw new NefantarisError(`No nefantaris.json found in ${siteDir}`);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new NefantarisError(`${configPath} is not valid JSON`);
    }
    if (!isRecord(parsed)) {
        throw new NefantarisError(`${configPath} must contain a JSON object`);
    }
    const { name, theme } = parsed;
    if (typeof name !== "string" || name === "") {
        throw new NefantarisError(
            `${configPath}: "name" must be a non-empty string`
        );
    }
    if (!isRecord(theme)) {
        throw new NefantarisError(`${configPath}: "theme" must be an object`);
    }
    const { source } = theme;
    if (typeof source !== "string" || source === "") {
        throw new NefantarisError(
            `${configPath}: "theme.source" must be a non-empty string`
        );
    }
    return { name, themeSource: source };
};
