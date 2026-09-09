import { assertKnownKeys } from "../manifest.js";
import { isRecord } from "../narrow.js";
import { NefantarisError } from "../NefantarisError.js";
import {
    manifestLabels,
    sourceConfigEntry,
    sourceReferenceFrom,
    type SourceConfigEntry,
    type SourceReference,
    type SourceReferenceLabels,
} from "../sources/reference.js";

export type PluginReference =
    { kind: "named"; name: string } | ({ name: string } & SourceReference);

export type PluginRequirement = Exclude<PluginReference, { kind: "local" }>;

export type PluginConfigEntry = string | ({ name: string } & SourceConfigEntry);

const referenceKeys = ["name", "source", "version"];

export const pluginReferenceFrom = (
    name: string,
    source: string,
    version: string | undefined,
    labels: SourceReferenceLabels
): PluginReference => ({
    name,
    ...sourceReferenceFrom(source, version, labels),
});

const readPinnedReference = (
    value: Record<string, unknown>,
    key: string,
    manifestPath: string
): PluginReference => {
    assertKnownKeys(value, key, referenceKeys, manifestPath);
    const { name, source, version } = value;
    if (typeof name !== "string" || name === "") {
        throw new NefantarisError(
            `${manifestPath}: "${key}.name" must be a non-empty string`
        );
    }
    if (typeof source !== "string" || source === "") {
        throw new NefantarisError(
            `${manifestPath}: "${key}.source" must be a non-empty string`
        );
    }
    if (
        version !== undefined &&
        (typeof version !== "string" || version === "")
    ) {
        throw new NefantarisError(
            `${manifestPath}: "${key}.version" must be a non-empty string`
        );
    }
    return pluginReferenceFrom(
        name,
        source,
        version,
        manifestLabels(key, manifestPath)
    );
};

const readPluginReference = (
    value: unknown,
    key: string,
    manifestPath: string
): PluginReference => {
    if (typeof value === "string" && value !== "") {
        return { kind: "named", name: value };
    }
    if (isRecord(value)) {
        return readPinnedReference(value, key, manifestPath);
    }
    throw new NefantarisError(
        `${manifestPath}: "${key}" must be a plugin name or an object with "name", "source", and "version"`
    );
};

export const readPluginReferences = (
    source: Record<string, unknown>,
    key: string,
    manifestPath: string
): PluginReference[] => {
    const value = source[key];
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw new NefantarisError(
            `${manifestPath}: "${key}" must be an array of plugin names or { name, source, version } objects`
        );
    }
    const seen = new Set<string>();
    return value.map((entry: unknown, index) => {
        const entryKey = `${key}[${String(index)}]`;
        const reference = readPluginReference(entry, entryKey, manifestPath);
        if (seen.has(reference.name)) {
            throw new NefantarisError(
                `${manifestPath}: "${entryKey}" lists "${reference.name}" again — each plugin appears in "${key}" once`
            );
        }
        seen.add(reference.name);
        return reference;
    });
};

export const pluginNames = (references: PluginReference[]): string[] =>
    references.map((reference) => reference.name);

export const pluginConfigEntry = (
    reference: PluginReference
): PluginConfigEntry =>
    reference.kind === "named"
        ? reference.name
        : { name: reference.name, ...sourceConfigEntry(reference) };
