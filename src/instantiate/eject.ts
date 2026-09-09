import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SiteConfig } from "../config.js";
import type { SiteContent } from "../content/index.js";
import { isRecord } from "../narrow.js";
import { NefantarisError } from "../NefantarisError.js";
import type { LoadedPlugins } from "../plugins/index.js";
import { installTheme } from "../themes/index.js";
import type { ThemeManifest } from "../themes/manifest.js";
import {
    copyAssets,
    copyTemplate,
    noGeneratedPlugins,
    skippedTemplateEntries,
    writeGeneratedContent,
    writeGeneratedPlugins,
} from "./index.js";

type EjectSiteOptions = {
    siteDir: string;
    outDir: string;
    templateDir: string;
    packageName: string;
    config: SiteConfig;
    manifest: ThemeManifest;
    content: SiteContent;
    plugins: LoadedPlugins;
};

const ejectSkippedEntries = new Set([
    ...skippedTemplateEntries,
    "package-lock.json",
    "README.md",
]);

const sortedRecord = (
    record: Record<string, unknown>
): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(record).sort(([first], [second]) =>
            first.localeCompare(second)
        )
    );

const ejectedPackageJson = (
    templatePackageJson: string,
    templatePackageJsonPath: string,
    packageName: string,
    pluginDependencies: Record<string, string>
): string => {
    const parsed: unknown = JSON.parse(templatePackageJson);
    if (!isRecord(parsed) || !isRecord(parsed.dependencies)) {
        throw new NefantarisError(
            `${templatePackageJsonPath} does not contain "dependencies"`
        );
    }
    const ejected = {
        ...parsed,
        name: packageName,
        dependencies: sortedRecord({
            ...parsed.dependencies,
            ...pluginDependencies,
        }),
    };
    return `${JSON.stringify(ejected, null, 4)}\n`;
};

const ejectedReadme = (siteName: string): string => `# ${siteName}

A standalone React site ejected from Nefantaris. Nothing here depends on
Nefantaris any more: the theme, the parsed content, and every plugin
dependency are ordinary files and \`package.json\` dependencies.

Built with React, TypeScript, Vite, Wouter, and Tailwind CSS.

- \`src/theme/\` — the theme components and \`theme.css\`
- \`src/generated/content.ts\` — the routes, posts, and nav parsed from the
  content repo
- \`src/nefantaris/\` — contract types, the markdown-tree renderer, head
  handling
- \`scripts/build.mjs\` — the Vite client and SSR builds, then one
  prerendered HTML file per route

## Commands

| Command                | Description                                   |
| ---------------------- | --------------------------------------------- |
| \`npm run dev\`          | Start the Vite dev server                     |
| \`npm run build\`        | Type-check, build, and prerender to \`dist/\`  |
| \`npm run preview\`      | Preview the production build                  |
| \`npm run lint\`         | Lint and auto-fix with ESLint                 |
| \`npm run lint:check\`   | Lint without fixing                           |
| \`npm run format\`       | Format with Prettier                          |
| \`npm run format:check\` | Check formatting without writing              |
`;

export const ejectSite = async ({
    siteDir,
    outDir,
    templateDir,
    packageName,
    config,
    manifest,
    content,
    plugins,
}: EjectSiteOptions): Promise<void> => {
    await mkdir(outDir, { recursive: true });
    await copyTemplate(templateDir, outDir, ejectSkippedEntries);
    await installTheme({ siteDir, nefantarisDir: outDir, manifest });
    await writeGeneratedContent(outDir, config, content);
    await writeGeneratedPlugins(outDir, noGeneratedPlugins);
    await copyAssets(siteDir, outDir);
    const templatePackageJsonPath = join(templateDir, "package.json");
    await writeFile(
        join(outDir, "package.json"),
        ejectedPackageJson(
            await readFile(templatePackageJsonPath, "utf8"),
            templatePackageJsonPath,
            packageName,
            plugins.dependencies
        )
    );
    await writeFile(join(outDir, "README.md"), ejectedReadme(config.name));
};
