import { existsSync } from "node:fs";
import { join } from "node:path";
import {
    assertContractVersion,
    readComponentMap,
    readContainedPath,
    readManifestName,
    readManifestObject,
} from "../manifest.js";
import { NefantarisError } from "../NefantarisError.js";
import {
    readPluginReferences,
    type PluginRequirement,
} from "../plugins/reference.js";

export const themeManifestFileName = "theme.json";
export const themeStylesheetFileName = "theme.css";
export const themeModuleFileName = "index.ts";
export const notFoundTemplateName = "notFound";
export const requiredTemplateNames = ["page", notFoundTemplateName];

export type ThemeManifest = {
    themeDir: string;
    name: string;
    layout: string;
    templates: Record<string, string>;
    directives: Record<string, string>;
    requires: PluginRequirement[];
};

const readTemplates = (
    source: Record<string, unknown>,
    manifestPath: string,
    themeDir: string
): Record<string, string> => {
    if (source.templates === undefined) {
        throw new NefantarisError(
            `${manifestPath}: "templates" must be an object declaring at least ${requiredTemplateNames
                .map((name) => `"${name}"`)
                .join(" and ")}`
        );
    }
    const templates = readComponentMap(
        source.templates,
        "templates",
        manifestPath,
        themeDir
    );
    for (const name of requiredTemplateNames) {
        if (templates[name] === undefined) {
            throw new NefantarisError(
                `${manifestPath}: "templates.${name}" is required — every theme must provide it`
            );
        }
    }
    return templates;
};

const readRequires = (
    source: Record<string, unknown>,
    manifestPath: string
): PluginRequirement[] =>
    readPluginReferences(source, "requires", manifestPath).map(
        (reference, index) => {
            if (reference.kind === "local") {
                throw new NefantarisError(
                    `${manifestPath}: "requires[${String(index)}].source" is a path — a theme pins the plugins it requires to a git URL and a tag or commit SHA, so the pin holds wherever the theme is used`
                );
            }
            return reference;
        }
    );

const assertThemeShape = (themeDir: string, manifestPath: string): void => {
    if (!existsSync(join(themeDir, themeStylesheetFileName))) {
        throw new NefantarisError(
            `${themeDir} is missing ${themeStylesheetFileName} — every theme ships one at its root`
        );
    }
    if (existsSync(join(themeDir, themeModuleFileName))) {
        throw new NefantarisError(
            `${themeDir} must not contain ${themeModuleFileName} — Nefantaris generates it from ${manifestPath}`
        );
    }
};

export const loadThemeManifest = async (
    themeDir: string
): Promise<ThemeManifest> => {
    const manifestPath = join(themeDir, themeManifestFileName);
    const parsed = await readManifestObject(
        manifestPath,
        `No ${themeManifestFileName} found in ${themeDir}`
    );
    const name = readManifestName(parsed, manifestPath);
    assertContractVersion(parsed, manifestPath);
    const { layout } = parsed;
    if (typeof layout !== "string" || layout === "") {
        throw new NefantarisError(
            `${manifestPath}: "layout" must be a non-empty string`
        );
    }
    assertThemeShape(themeDir, manifestPath);
    return {
        themeDir,
        name,
        layout: readContainedPath(layout, "layout", manifestPath, themeDir),
        templates: readTemplates(parsed, manifestPath, themeDir),
        directives: readComponentMap(
            parsed.directives,
            "directives",
            manifestPath,
            themeDir
        ),
        requires: readRequires(parsed, manifestPath),
    };
};

export const requiredPluginNames = (manifest: ThemeManifest): string[] =>
    manifest.requires.map((requirement) => requirement.name);

export const selectableTemplateNames = (manifest: ThemeManifest): string[] =>
    Object.keys(manifest.templates)
        .filter((name) => name !== notFoundTemplateName)
        .sort();
