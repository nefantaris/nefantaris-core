import {
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { readCoreVersion } from "../coreVersion.js";
import { NefantarisError } from "../NefantarisError.js";
import { loadThemeManifest, type ThemeManifest } from "../themes/manifest.js";
import {
    localThemeVersion,
    themeReferenceFrom,
    type ThemeReference,
    type ThemeReferenceLabels,
} from "../themes/reference.js";
import { resolveThemeDir } from "../themes/resolve.js";
import { packageNameFrom } from "./packageName.js";

export const defaultThemeSource = "../nefantaris-theme-base";

const initThemeLabels: ThemeReferenceLabels = {
    prefix: "",
    source: "--theme",
    version: "--theme-version",
};

const configTheme = (
    theme: ThemeReference
): { source: string; version: string } =>
    theme.kind === "local"
        ? { source: theme.path, version: localThemeVersion }
        : { source: theme.url, version: theme.version };

const starterConfig = (
    name: string,
    theme: ThemeReference,
    plugins: string[]
): string =>
    `${JSON.stringify(
        {
            name,
            theme: configTheme(theme),
            nav: [
                { label: "Home", href: "/" },
                { label: "About", href: "/about" },
            ],
            plugins,
        },
        null,
        4
    )}\n`;

const starterPackageJson = (packageName: string, coreVersion: string): string =>
    `${JSON.stringify(
        {
            name: packageName,
            version: "0.0.0",
            private: true,
            scripts: { dev: "nef dev", build: "nef build" },
            devDependencies: { "@nefantaris/core": coreVersion },
        },
        null,
        4
    )}\n`;

const starterHomePage = `---
title: Home
description: Welcome to your new Nefantaris site.
---

# Welcome

This is your first page. Edit it in your editor, then publish.

`;

const starterAboutPage = `---
title: About
description: About this site.
---

# About

Replace this page with something about you or your project.

`;

const starterPost = (date: string): string => `---
title: Hello World
description: The first post on this site.
date: "${date}"
---

This is your first post. Write your own next to it in \`content/posts/\`,
then publish.

`;

const starterGitignore = `.nefantaris/
dist/
node_modules/
`;

const localDateStamp = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const discardStartedSite = (siteDir: string, isNewDir: boolean): void => {
    rmSync(isNewDir ? siteDir : join(siteDir, ".nefantaris"), {
        recursive: true,
        force: true,
    });
};

const loadStartingTheme = async (
    siteDir: string,
    theme: ThemeReference
): Promise<ThemeManifest> => {
    const isNewDir = !existsSync(siteDir);
    mkdirSync(siteDir, { recursive: true });
    try {
        return await loadThemeManifest(await resolveThemeDir(siteDir, theme));
    } catch (error) {
        discardStartedSite(siteDir, isNewDir);
        throw error;
    }
};

export const runInit = async (
    siteDirArg: string,
    themeSourceArg = defaultThemeSource,
    themeVersionArg?: string
): Promise<void> => {
    const siteDir = resolve(process.cwd(), siteDirArg);
    const name = basename(siteDir);
    if (name === "" || name === ".") {
        throw new NefantarisError(
            `Could not determine a site name from "${siteDirArg}"`
        );
    }
    if (existsSync(siteDir) && readdirSync(siteDir).length > 0) {
        throw new NefantarisError(`${siteDir} already exists and is not empty`);
    }
    const theme = themeReferenceFrom(
        themeSourceArg,
        themeVersionArg,
        initThemeLabels
    );
    const manifest = await loadStartingTheme(siteDir, theme);
    const plugins = [...manifest.requires];
    const coreVersion = await readCoreVersion();
    const today = localDateStamp(new Date());
    mkdirSync(`${siteDir}/content/pages`, { recursive: true });
    mkdirSync(`${siteDir}/content/posts`, { recursive: true });
    mkdirSync(`${siteDir}/assets`, { recursive: true });
    writeFileSync(
        `${siteDir}/nefantaris.json`,
        starterConfig(name, theme, plugins)
    );
    writeFileSync(
        `${siteDir}/package.json`,
        starterPackageJson(packageNameFrom(name), coreVersion)
    );
    writeFileSync(`${siteDir}/content/pages/index.md`, starterHomePage);
    writeFileSync(`${siteDir}/content/pages/about.md`, starterAboutPage);
    writeFileSync(
        `${siteDir}/content/posts/hello-world.md`,
        starterPost(today)
    );
    writeFileSync(`${siteDir}/.gitignore`, starterGitignore);
    writeFileSync(`${siteDir}/assets/.gitkeep`, "");
    console.log(`Created a Nefantaris site at ${siteDir} (${name}).`);
    console.log(
        'Run "npm install" and then "npm run dev" inside it to preview it.'
    );
};
