import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertKnownKeys } from "./manifest.js";
import { readModeDefault, readModeList, type ModeConfig } from "./modes.js";
import { NefantarisError } from "./NefantarisError.js";
import { isRecord } from "./narrow.js";
import {
    readPluginReferences,
    type PluginReference,
} from "./plugins/reference.js";
import {
    readSourceReference,
    type SourceReference,
} from "./sources/reference.js";

export type NavItem = {
    label: string;
    href: string;
    children?: NavItem[];
};

export type SiteConfig = {
    configPath: string;
    name: string;
    theme: SourceReference;
    nav: NavItem[];
    plugins: PluginReference[];
    modes: ModeConfig;
};

const modeConfigKeys = ["default", "exclude"];

const readTheme = (value: unknown, configPath: string): SourceReference => {
    if (!isRecord(value)) {
        throw new NefantarisError(`${configPath}: "theme" must be an object`);
    }
    return readSourceReference(value, "theme", configPath);
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

const readModes = (value: unknown, configPath: string): ModeConfig => {
    if (value === undefined) {
        return { exclude: [] };
    }
    if (!isRecord(value)) {
        throw new NefantarisError(`${configPath}: "modes" must be an object`);
    }
    assertKnownKeys(value, "modes", modeConfigKeys, configPath);
    const modes: ModeConfig = {
        exclude:
            value.exclude === undefined
                ? []
                : readModeList(value.exclude, "modes.exclude", configPath),
    };
    const configuredDefault = readModeDefault(
        value.default,
        "modes.default",
        configPath
    );
    if (configuredDefault !== undefined) {
        modes.default = configuredDefault;
    }
    return modes;
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
    const { name, theme, nav, modes } = parsed;
    if (typeof name !== "string" || name === "") {
        throw new NefantarisError(
            `${configPath}: "name" must be a non-empty string`
        );
    }
    return {
        configPath,
        name,
        theme: readTheme(theme, configPath),
        nav: readNav(nav, "nav", configPath),
        plugins: readPluginReferences(parsed, "plugins", configPath),
        modes: readModes(modes, configPath),
    };
};
