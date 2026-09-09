import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { NefantarisError } from "./NefantarisError.js";
import { isRecord } from "./narrow.js";

export const contractVersion = 1;

const componentNamePattern = /^[A-Za-z][A-Za-z0-9-]*$/;

export const readManifestObject = async (
    manifestPath: string,
    missingMessage: string
): Promise<Record<string, unknown>> => {
    let text: string;
    try {
        text = await readFile(manifestPath, "utf8");
    } catch {
        throw new NefantarisError(missingMessage);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new NefantarisError(`${manifestPath} is not valid JSON`);
    }
    if (!isRecord(parsed)) {
        throw new NefantarisError(`${manifestPath} must contain a JSON object`);
    }
    return parsed;
};

export const readManifestName = (
    source: Record<string, unknown>,
    manifestPath: string
): string => {
    const { name } = source;
    if (typeof name !== "string" || name === "") {
        throw new NefantarisError(
            `${manifestPath}: "name" must be a non-empty string`
        );
    }
    return name;
};

export const assertContractVersion = (
    source: Record<string, unknown>,
    manifestPath: string
): void => {
    if (source.contract !== contractVersion) {
        throw new NefantarisError(
            `${manifestPath}: "contract" must be ${String(contractVersion)}`
        );
    }
};

export const readContainedPath = (
    value: string,
    key: string,
    manifestPath: string,
    rootDir: string
): string => {
    const target = resolve(rootDir, value);
    const inside = relative(rootDir, target);
    if (inside === "" || inside.startsWith("..") || isAbsolute(inside)) {
        throw new NefantarisError(
            `${manifestPath}: "${key}" is "${value}", which is outside ${rootDir}`
        );
    }
    if (!existsSync(target)) {
        throw new NefantarisError(
            `${manifestPath}: "${key}" is "${value}", which does not exist in ${rootDir}`
        );
    }
    return inside.split(sep).join("/");
};

export const readComponentMap = (
    value: unknown,
    key: string,
    manifestPath: string,
    rootDir: string
): Record<string, string> => {
    if (value === undefined) {
        return {};
    }
    if (!isRecord(value)) {
        throw new NefantarisError(
            `${manifestPath}: "${key}" must be an object`
        );
    }
    const paths: Record<string, string> = {};
    for (const [name, entry] of Object.entries(value)) {
        if (!componentNamePattern.test(name)) {
            throw new NefantarisError(
                `${manifestPath}: "${key}.${name}" must start with a letter and use only letters, digits, and hyphens`
            );
        }
        if (typeof entry !== "string" || entry === "") {
            throw new NefantarisError(
                `${manifestPath}: "${key}.${name}" must be a non-empty string`
            );
        }
        paths[name] = readContainedPath(
            entry,
            `${key}.${name}`,
            manifestPath,
            rootDir
        );
    }
    return paths;
};

export const assertKnownKeys = (
    source: Record<string, unknown>,
    key: string,
    allowed: string[],
    manifestPath: string
): void => {
    for (const name of Object.keys(source)) {
        if (!allowed.includes(name)) {
            throw new NefantarisError(
                `${manifestPath}: "${key}.${name}" is not a recognised key — ${key} accepts ${allowed.map((entry) => `"${entry}"`).join(", ")}`
            );
        }
    }
};
