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
import { runGit } from "./commands";
import { fixtureSiteDir } from "./fixtureSite";

export const testThemeDir = fileURLToPath(
    new URL("../fixtures/test-theme", import.meta.url)
);

export const secondCommitMarker = "--nefantaris-e2e-second-commit: 1;";

export type ThemeConfig = { source: string; version?: string };

export type ThemeRepo = {
    repoDir: string;
    url: string;
    tag: string;
    headSha: string;
};

const skippedThemeEntries = new Set([
    ".nefantaris",
    "node_modules",
    "tsconfig.json",
]);

const gitSettings = ["-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false"];

export const makeTempDir = (label: string): Promise<string> =>
    mkdtemp(join(tmpdir(), `nefantaris-${label}-`));

export const writeTempSite = async (
    siteDir: string,
    theme: ThemeConfig,
    plugins: string[] = []
): Promise<void> => {
    await mkdir(siteDir, { recursive: true });
    for (const entry of ["content", "assets"]) {
        await cp(join(fixtureSiteDir, entry), join(siteDir, entry), {
            recursive: true,
        });
    }
    const fixtureConfig = JSON.parse(
        await readFile(join(fixtureSiteDir, "nefantaris.json"), "utf8")
    ) as Record<string, unknown>;
    const config = { ...fixtureConfig, theme, plugins };
    await writeFile(
        join(siteDir, "nefantaris.json"),
        `${JSON.stringify(config, null, 4)}\n`
    );
};

export const createThemeRepo = async (repoDir: string): Promise<ThemeRepo> => {
    await cp(testThemeDir, repoDir, {
        recursive: true,
        filter: (source) => !skippedThemeEntries.has(basename(source)),
    });
    const git = async (...args: string[]): Promise<string> => {
        const result = await runGit([...gitSettings, ...args], repoDir);
        if (result.exitCode !== 0) {
            throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
        }
        return result.stdout.trim();
    };
    await git("init", "--quiet");
    await git("config", "user.email", "e2e@nefantaris.test");
    await git("config", "user.name", "Nefantaris e2e");
    await git("add", ".");
    await git("commit", "--quiet", "--message", "Tagged theme");
    await git("tag", "v1.0.0");
    await appendFile(
        join(repoDir, "theme.css"),
        `\n:root {\n    ${secondCommitMarker}\n}\n`
    );
    await git("commit", "--quiet", "--all", "--message", "Untagged follow-up");
    const headSha = await git("rev-parse", "HEAD");
    return {
        repoDir,
        url: pathToFileURL(repoDir).href,
        tag: "v1.0.0",
        headSha,
    };
};
