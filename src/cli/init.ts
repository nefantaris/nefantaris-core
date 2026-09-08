import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { readCoreVersion } from "../coreVersion.js";
import { NefantarisError } from "../NefantarisError.js";
import { loadThemeManifest } from "../themes/manifest.js";
import { packageNameFrom } from "./packageName.js";

const starterConfig = (
    name: string,
    themeSource: string,
    plugins: string[]
): string =>
    `${JSON.stringify(
        {
            name,
            theme: { source: themeSource, version: "local" },
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

export const runInit = async (
    siteDirArg: string,
    themeSourceArg = "../nefantaris-theme-base"
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
    const themeDir = resolve(siteDir, themeSourceArg);
    const manifest = await loadThemeManifest(themeDir);
    const plugins = [...manifest.requires];
    const coreVersion = await readCoreVersion();
    const today = localDateStamp(new Date());
    mkdirSync(siteDir, { recursive: true });
    mkdirSync(`${siteDir}/content/pages`, { recursive: true });
    mkdirSync(`${siteDir}/content/posts`, { recursive: true });
    mkdirSync(`${siteDir}/assets`, { recursive: true });
    writeFileSync(
        `${siteDir}/nefantaris.json`,
        starterConfig(name, themeSourceArg, plugins)
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
