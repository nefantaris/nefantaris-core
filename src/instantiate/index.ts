import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SiteConfig } from "../config.js";
import type { SiteContent } from "../content/index.js";
import {
    resolveModes,
    systemModeDefault,
    type ModeSettings,
} from "../modes.js";
import { isRecord } from "../narrow.js";
import { NefantarisError } from "../NefantarisError.js";
import { pluginTsconfigPaths, type ResolvedPlugins } from "../plugins/index.js";
import { runCommand } from "../run.js";
import { installTheme } from "../themes/index.js";
import type { ThemeManifest } from "../themes/manifest.js";

type InstantiateSiteOptions = {
    siteDir: string;
    nefantarisDir: string;
    templateDir: string;
    config: SiteConfig;
    manifest: ThemeManifest;
    content: SiteContent;
    plugins: ResolvedPlugins;
};

export const skippedTemplateEntries = new Set([
    "node_modules",
    "dist",
    "dist-server",
]);

export const copyTemplate = async (
    templateDir: string,
    targetDir: string,
    skipped: Set<string> = skippedTemplateEntries
): Promise<void> => {
    for (const entry of await readdir(templateDir, { withFileTypes: true })) {
        if (skipped.has(entry.name)) {
            continue;
        }
        const target = join(targetDir, entry.name);
        await rm(target, { recursive: true, force: true });
        await cp(join(templateDir, entry.name), target, { recursive: true });
    }
};

const renderGeneratedContent = (
    config: SiteConfig,
    content: SiteContent,
    modes: ModeSettings
): string =>
    [
        "import type {",
        "    ModeSettings,",
        "    NavItem,",
        "    PostSummary,",
        "    RouteEntry,",
        "    SiteMeta,",
        '} from "../nefantaris/types";',
        "",
        `export const site: SiteMeta = ${JSON.stringify({ name: config.name }, null, 4)};`,
        "",
        `export const nav: NavItem[] = ${JSON.stringify(config.nav, null, 4)};`,
        "",
        `export const routes: RouteEntry[] = ${JSON.stringify(content.routes, null, 4)};`,
        "",
        `export const posts: PostSummary[] = ${JSON.stringify(content.posts, null, 4)};`,
        "",
        `export const modeSettings: ModeSettings = ${JSON.stringify(modes, null, 4)};`,
        "",
    ].join("\n");

export const writeGeneratedContent = async (
    nefantarisDir: string,
    config: SiteConfig,
    content: SiteContent,
    modes: ModeSettings
): Promise<void> => {
    const generatedDir = join(nefantarisDir, "src", "generated");
    await mkdir(generatedDir, { recursive: true });
    await writeFile(
        join(generatedDir, "content.ts"),
        renderGeneratedContent(config, content, modes)
    );
};

const htmlOpenTagPattern = /<html\b[^>]*>/;

const htmlOpenTag = (modes: ModeSettings): string => {
    const attributes = [
        'lang="en"',
        `data-modes="${modes.available.join(" ")}"`,
        `data-default-mode="${modes.default}"`,
    ];
    if (modes.default !== systemModeDefault) {
        attributes.push(`data-mode="${modes.default}"`);
    }
    return `<html ${attributes.join(" ")}>`;
};

export const writeHtmlModeAttributes = async (
    nefantarisDir: string,
    modes: ModeSettings
): Promise<void> => {
    const indexHtmlPath = join(nefantarisDir, "index.html");
    const html = await readFile(indexHtmlPath, "utf8");
    if (!htmlOpenTagPattern.test(html)) {
        throw new NefantarisError(
            `${indexHtmlPath} has no <html> tag to carry the mode attributes`
        );
    }
    await writeFile(
        indexHtmlPath,
        html.replace(htmlOpenTagPattern, htmlOpenTag(modes))
    );
};

type GeneratedPlugins = Pick<ResolvedPlugins, "aliases" | "roots">;

export const noGeneratedPlugins: GeneratedPlugins = { aliases: {}, roots: [] };

const renderGeneratedPlugins = ({ aliases, roots }: GeneratedPlugins): string =>
    [
        `export const pluginAliases: Record<string, string> = ${JSON.stringify(aliases, null, 4)};`,
        "",
        `export const pluginRoots: string[] = ${JSON.stringify(roots, null, 4)};`,
        "",
    ].join("\n");

export const writeGeneratedPlugins = async (
    nefantarisDir: string,
    plugins: GeneratedPlugins
): Promise<void> => {
    const generatedDir = join(nefantarisDir, "src", "generated");
    await mkdir(generatedDir, { recursive: true });
    await writeFile(
        join(generatedDir, "plugins.ts"),
        renderGeneratedPlugins(plugins)
    );
};

const writeTsconfigPaths = async (
    nefantarisDir: string,
    aliases: Record<string, string>
): Promise<void> => {
    const tsconfigPath = join(nefantarisDir, "tsconfig.json");
    const parsed: unknown = JSON.parse(await readFile(tsconfigPath, "utf8"));
    if (!isRecord(parsed) || !isRecord(parsed.compilerOptions)) {
        throw new NefantarisError(
            `${tsconfigPath} does not contain "compilerOptions"`
        );
    }
    const { compilerOptions } = parsed;
    const existing = isRecord(compilerOptions.paths)
        ? compilerOptions.paths
        : {};
    const merged = {
        ...parsed,
        compilerOptions: {
            ...compilerOptions,
            paths: { ...existing, ...pluginTsconfigPaths(aliases) },
        },
    };
    await writeFile(tsconfigPath, `${JSON.stringify(merged, null, 4)}\n`);
};

export const copyAssets = async (
    siteDir: string,
    nefantarisDir: string
): Promise<void> => {
    const target = join(nefantarisDir, "public", "assets");
    await rm(target, { recursive: true, force: true });
    const assetsDir = join(siteDir, "assets");
    if (existsSync(assetsDir)) {
        await cp(assetsDir, target, { recursive: true });
    }
};

const gitignoreHasEntry = (lines: string[], entry: string): boolean =>
    lines.some((line) => {
        const trimmed = line.trim();
        return trimmed === entry || trimmed === `${entry}/`;
    });

export const ensureSiteGitignore = async (
    siteDir: string,
    entries: string[] = [".nefantaris", "dist"]
): Promise<void> => {
    const gitignorePath = join(siteDir, ".gitignore");
    const existing = existsSync(gitignorePath)
        ? await readFile(gitignorePath, "utf8")
        : "";
    const lines = existing.split("\n");
    const missing = entries.filter((entry) => !gitignoreHasEntry(lines, entry));
    if (missing.length === 0) {
        return;
    }
    const additions = missing.map((entry) => `${entry}/`).join("\n");
    const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
    await writeFile(gitignorePath, `${existing}${separator}${additions}\n`);
    console.log(
        `Added ${missing.map((entry) => `${entry}/`).join(" and ")} to ${gitignorePath}`
    );
};

const ensureDependencies = async (
    nefantarisDir: string,
    previousPackageJson: string | undefined
): Promise<void> => {
    const currentPackageJson = await readFile(
        join(nefantarisDir, "package.json"),
        "utf8"
    );
    const hasNodeModules = existsSync(join(nefantarisDir, "node_modules"));
    if (hasNodeModules && currentPackageJson === previousPackageJson) {
        return;
    }
    await runCommand(
        "npm",
        ["install", "--no-audit", "--no-fund"],
        nefantarisDir
    );
};

export const instantiateSite = async ({
    siteDir,
    nefantarisDir,
    templateDir,
    config,
    manifest,
    content,
    plugins,
}: InstantiateSiteOptions): Promise<void> => {
    const modes = resolveModes(config, manifest);
    const packageJsonPath = join(nefantarisDir, "package.json");
    const previousPackageJson = existsSync(packageJsonPath)
        ? await readFile(packageJsonPath, "utf8")
        : undefined;
    await mkdir(nefantarisDir, { recursive: true });
    await copyTemplate(templateDir, nefantarisDir);
    await writeHtmlModeAttributes(nefantarisDir, modes);
    await ensureSiteGitignore(siteDir);
    await installTheme({ siteDir, nefantarisDir, manifest });
    await writeGeneratedContent(nefantarisDir, config, content, modes);
    await writeGeneratedPlugins(nefantarisDir, plugins);
    await writeTsconfigPaths(nefantarisDir, plugins.aliases);
    await copyAssets(siteDir, nefantarisDir);
    await ensureDependencies(nefantarisDir, previousPackageJson);
};
