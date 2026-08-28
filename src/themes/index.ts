import { existsSync } from "node:fs";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { collectThemeFiles } from "./files.js";
import {
    notFoundTemplateName,
    themeModuleFileName,
    type ThemeManifest,
} from "./manifest.js";

type InstallThemeOptions = {
    siteDir: string;
    nefantarisDir: string;
    manifest: ThemeManifest;
};

type ThemeImport = { identifier: string; specifier: string };

const contractModuleSpecifier = "../nefantaris/types";

const pascalCase = (name: string): string =>
    name
        .split(/[^A-Za-z0-9]+/)
        .filter((part) => part !== "")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");

const templateIdentifier = (name: string): string =>
    `${pascalCase(name)}Template`;

const directiveIdentifier = (name: string): string =>
    `${pascalCase(name)}Directive`;

const moduleSpecifier = (themePath: string): string =>
    `./${themePath.replace(/\.[jt]sx?$/, "")}`;

const propertyKey = (name: string): string =>
    /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);

const recordLines = (
    key: string,
    entries: [string, string][],
    indent: string
): string[] => {
    if (entries.length === 0) {
        return [`${indent}${key}: {},`];
    }
    return [
        `${indent}${key}: {`,
        ...entries.map(
            ([name, identifier]) =>
                `${indent}    ${propertyKey(name)}: ${identifier},`
        ),
        `${indent}},`,
    ];
};

const themeModuleSource = (manifest: ThemeManifest): string => {
    const templates = Object.entries(manifest.templates).filter(
        ([name]) => name !== notFoundTemplateName
    );
    const directives = Object.entries(manifest.directives);
    const imports: ThemeImport[] = [
        { identifier: "Layout", specifier: moduleSpecifier(manifest.layout) },
        {
            identifier: templateIdentifier(notFoundTemplateName),
            specifier: moduleSpecifier(
                manifest.templates[notFoundTemplateName]
            ),
        },
        ...templates.map(([name, path]) => ({
            identifier: templateIdentifier(name),
            specifier: moduleSpecifier(path),
        })),
        ...directives.map(([name, path]) => ({
            identifier: directiveIdentifier(name),
            specifier: moduleSpecifier(path),
        })),
    ].sort((first, second) => first.specifier.localeCompare(second.specifier));
    return [
        `import type { Theme } from "${contractModuleSpecifier}";`,
        ...imports.map(
            ({ identifier, specifier }) =>
                `import ${identifier} from "${specifier}";`
        ),
        "",
        "export const theme: Theme = {",
        "    Layout,",
        `    notFound: ${templateIdentifier(notFoundTemplateName)},`,
        ...recordLines(
            "templates",
            templates.map(([name]) => [name, templateIdentifier(name)]),
            "    "
        ),
        ...recordLines(
            "directives",
            directives.map(([name]) => [name, directiveIdentifier(name)]),
            "    "
        ),
        "};",
        "",
    ].join("\n");
};

const copyThemeFiles = async (
    themeDir: string,
    target: string
): Promise<void> => {
    await mkdir(target, { recursive: true });
    for (const file of await collectThemeFiles(themeDir)) {
        const destination = join(target, file);
        await mkdir(dirname(destination), { recursive: true });
        await cp(join(themeDir, file), destination);
    }
};

export const installTheme = async ({
    siteDir,
    nefantarisDir,
    manifest,
}: InstallThemeOptions): Promise<void> => {
    const target = join(nefantarisDir, "src", "theme");
    await rm(target, { recursive: true, force: true });
    await copyThemeFiles(manifest.themeDir, target);
    const childThemeDir = join(siteDir, "child-theme");
    if (existsSync(childThemeDir)) {
        await cp(childThemeDir, target, { recursive: true, force: true });
    }
    await writeFile(
        join(target, themeModuleFileName),
        themeModuleSource(manifest)
    );
};
