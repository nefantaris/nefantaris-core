import type { SiteConfig } from "./config.js";
import { NefantarisError } from "./NefantarisError.js";
import type { ThemeManifest } from "./themes/manifest.js";

export type Mode = "light" | "dark";
export type ModeDefault = Mode | "system";
export type ModeSettings = { available: Mode[]; default: ModeDefault };

export type ModeConfig = { default?: ModeDefault; exclude: Mode[] };

export const systemModeDefault = "system";
export const defaultThemeModes: Mode[] = ["light"];

const modeVocabulary = '"light" or "dark"';
const modeDefaultVocabulary = '"light", "dark", or "system"';

export const isMode = (value: unknown): value is Mode =>
    value === "light" || value === "dark";

export const isModeDefault = (value: unknown): value is ModeDefault =>
    value === systemModeDefault || isMode(value);

const quoteModes = (modes: Mode[]): string =>
    modes.map((mode) => `"${mode}"`).join(", ");

export const readModeList = (
    value: unknown,
    key: string,
    filePath: string
): Mode[] => {
    if (!Array.isArray(value)) {
        throw new NefantarisError(`${filePath}: "${key}" must be an array`);
    }
    const modes = value.map((entry: unknown, index): Mode => {
        if (!isMode(entry)) {
            throw new NefantarisError(
                `${filePath}: "${key}[${String(index)}]" must be ${modeVocabulary}`
            );
        }
        return entry;
    });
    if (new Set(modes).size !== modes.length) {
        throw new NefantarisError(
            `${filePath}: "${key}" must not repeat a mode`
        );
    }
    return modes;
};

export const readModeDefault = (
    value: unknown,
    key: string,
    filePath: string
): ModeDefault | undefined => {
    if (value === undefined) {
        return undefined;
    }
    if (!isModeDefault(value)) {
        throw new NefantarisError(
            `${filePath}: "${key}" must be ${modeDefaultVocabulary}`
        );
    }
    return value;
};

const assertExcludedModesDeclared = (
    config: SiteConfig,
    manifest: ThemeManifest
): void => {
    config.modes.exclude.forEach((mode, index) => {
        if (!manifest.modes.includes(mode)) {
            throw new NefantarisError(
                `${config.configPath}: "modes.exclude[${String(index)}]" is "${mode}", which theme "${manifest.name}" does not declare — it declares ${quoteModes(manifest.modes)}`
            );
        }
    });
};

const resolveModeDefault = (
    configured: ModeDefault | undefined,
    available: Mode[],
    configPath: string
): ModeDefault => {
    const [firstAvailable] = available;
    const hasChoice = available.length > 1;
    if (configured === undefined) {
        return hasChoice ? systemModeDefault : firstAvailable;
    }
    if (configured === systemModeDefault) {
        if (!hasChoice) {
            throw new NefantarisError(
                `${configPath}: "modes.default" is "system", but only "${firstAvailable}" is available — there is nothing for the system preference to choose between`
            );
        }
        return configured;
    }
    if (!available.includes(configured)) {
        throw new NefantarisError(
            `${configPath}: "modes.default" is "${configured}", which is not available — the available modes are ${quoteModes(available)}`
        );
    }
    return configured;
};

export const resolveModes = (
    config: SiteConfig,
    manifest: ThemeManifest
): ModeSettings => {
    assertExcludedModesDeclared(config, manifest);
    const available = manifest.modes.filter(
        (mode) => !config.modes.exclude.includes(mode)
    );
    if (available.length === 0) {
        throw new NefantarisError(
            `${config.configPath}: "modes.exclude" removes every mode theme "${manifest.name}" declares — at least one of ${quoteModes(manifest.modes)} must stay available`
        );
    }
    return {
        available,
        default: resolveModeDefault(
            config.modes.default,
            available,
            config.configPath
        ),
    };
};
