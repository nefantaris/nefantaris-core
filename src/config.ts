import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readStringArray } from "./manifest.js";
import { NefantarisError } from "./NefantarisError.js";
import { isRecord } from "./narrow.js";

export type NavItem = {
    label: string;
    href: string;
    children?: NavItem[];
};

export type SiteConfig = {
    configPath: string;
    name: string;
    themeSource: string;
    nav: NavItem[];
    plugins: string[];
};

const readNavItem = (
    value: unknown,
    key: string,
    configPath: string
): NavItem => {
    if (!isRecord(value)) {
        throw new NefantarisError(`${configPath}: "${key}" must be an object`);
    }
    const { label, href, children } = value;
    if (typeof label !== "string" || label === "") {
        throw new NefantarisError(
            `${configPath}: "${key}.label" must be a non-empty string`
        );
    }
    if (typeof href !== "string" || href === "") {
        throw new NefantarisError(
            `${configPath}: "${key}.href" must be a non-empty string`
        );
    }
    const item: NavItem = { label, href };
    const nested = readNav(children, `${key}.children`, configPath);
    if (nested.length > 0) {
        item.children = nested;
    }
    return item;
};

const readNav = (
    value: unknown,
    key: string,
    configPath: string
): NavItem[] => {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new NefantarisError(`${configPath}: "${key}" must be an array`);
    }
    return value.map((entry: unknown, index) =>
        readNavItem(entry, `${key}[${String(index)}]`, configPath)
    );
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
    const { name, theme, nav } = parsed;
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
    return {
        configPath,
        name,
        themeSource: source,
        nav: readNav(nav, "nav", configPath),
        plugins: readStringArray(parsed, "plugins", configPath, "plugin names"),
    };
};
