import {
    appendFile,
    cp,
    mkdir,
    mkdtemp,
    readFile,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { format } from "prettier";
import { isRecord } from "../src/narrow.js";
import type { PluginConfigEntry } from "../src/plugins/reference.js";
import { runGit } from "./commands";
import { fixtureSiteDir } from "./fixtureSite";

export const testThemeDir = fileURLToPath(
    new URL("../fixtures/test-theme", import.meta.url)
);

export const secondCommitMarker = "--nefantaris-e2e-second-commit: 1;";
export const secondCommitFileName = "README.md";

export const testPluginName = "nefantaris-test-plugin";
export const testPluginDependencies = { "date-fns": "4.4.0" };

export type ThemeConfig = { source: string; version?: string };

export type TestRepo = {
    repoDir: string;
    url: string;
    tag: string;
    headSha: string;
};

type Git = (...args: string[]) => Promise<string>;

const repoTag = "v1.0.0";

const skippedThemeEntries = new Set([
    ".nefantaris",
    "node_modules",
    "tsconfig.json",
]);

const gitSettings = ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false"];

const gitIn =
    (repoDir: string): Git =>
    async (...args: string[]): Promise<string> => {
        const result = await runGit([...gitSettings, ...args], repoDir);
        if (result.exitCode !== 0) {
            throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
        }
        return result.stdout.trim();
    };

const commitTagged = async (repoDir: string, message: string): Promise<Git> => {
    const git = gitIn(repoDir);
    await git("init", "--quiet");
    await git("config", "user.email", "e2e@nefantaris.test");
    await git("config", "user.name", "Nefantaris e2e");
    await git("add", ".");
    await git("commit", "--quiet", "--message", message);
    await git("tag", repoTag);
    return git;
};

const repoAt = async (repoDir: string, git: Git): Promise<TestRepo> => ({
    repoDir,
    url: pathToFileURL(repoDir).href,
    tag: repoTag,
    headSha: await git("rev-parse", "HEAD"),
});

export const makeTempDir = (label: string): Promise<string> =>
    mkdtemp(join(tmpdir(), `nefantaris-${label}-`));

const readJsonObject = async (
    filePath: string
): Promise<Record<string, unknown>> => {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (!isRecord(parsed)) {
        throw new Error(`${filePath} does not contain a JSON object`);
    }
    return parsed;
};

const writeJsonFile = async (
    filePath: string,
    value: Record<string, unknown>
): Promise<void> => {
    await writeFile(
        filePath,
        await format(JSON.stringify(value, null, 4), {
            parser: "json",
            tabWidth: 4,
        })
    );
};

export const amendJsonFile = async (
    filePath: string,
    patch: Record<string, unknown>
): Promise<void> => {
    const existing = await readJsonObject(filePath);
    await writeJsonFile(filePath, { ...existing, ...patch });
};

export const writeTempSite = async (
    siteDir: string,
    theme: ThemeConfig,
    plugins: PluginConfigEntry[] = []
): Promise<void> => {
    await mkdir(siteDir, { recursive: true });
    for (const entry of ["content", "assets"]) {
        await cp(join(fixtureSiteDir, entry), join(siteDir, entry), {
            recursive: true,
        });
    }
    const fixtureConfig = await readJsonObject(
        join(fixtureSiteDir, "nefantaris.json")
    );
    await writeJsonFile(join(siteDir, "nefantaris.json"), {
        ...fixtureConfig,
        theme,
        plugins,
    });
};

export const writeTestPlugin = async (pluginDir: string): Promise<void> => {
    await mkdir(pluginDir, { recursive: true });
    await writeJsonFile(join(pluginDir, "plugin.json"), {
        name: testPluginName,
        contract: 1,
        provides: { dependencies: testPluginDependencies },
    });
};

export const writeThemeDir = async (
    themeDir: string,
    requires: PluginConfigEntry[] = []
): Promise<void> => {
    await cp(testThemeDir, themeDir, {
        recursive: true,
        filter: (source) => !skippedThemeEntries.has(basename(source)),
    });
    if (requires.length === 0) {
        return;
    }
    await amendJsonFile(join(themeDir, "theme.json"), { requires });
};

export const createThemeRepo = async (
    repoDir: string,
    requires: PluginConfigEntry[] = []
): Promise<TestRepo> => {
    await writeThemeDir(repoDir, requires);
    const git = await commitTagged(repoDir, "Tagged theme");
    await appendFile(
        join(repoDir, "theme.css"),
        `\n:root {\n    ${secondCommitMarker}\n}\n`
    );
    await git("commit", "--quiet", "--all", "--message", "Untagged follow-up");
    return repoAt(repoDir, git);
};

export const createPluginRepo = async (repoDir: string): Promise<TestRepo> => {
    await writeTestPlugin(repoDir);
    const git = await commitTagged(repoDir, "Tagged plugin");
    await writeFile(
        join(repoDir, secondCommitFileName),
        `${secondCommitMarker}\n`
    );
    await git("add", ".");
    await git("commit", "--quiet", "--message", "Untagged follow-up");
    return repoAt(repoDir, git);
};
