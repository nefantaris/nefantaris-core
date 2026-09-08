import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { captureCommand } from "../run.js";
import type { ThemeReference } from "./reference.js";

type GitTheme = Extract<ThemeReference, { kind: "git" }>;

export const themeCacheDirName = "themes";

const fullShaPattern = /^[0-9a-f]{40}$/;
const gitEnvironment = { GIT_TERMINAL_PROMPT: "0" };

export const themeCacheDir = (siteDir: string): string =>
    join(siteDir, ".nefantaris", themeCacheDirName);

const safeSegment = (value: string): string =>
    value.replace(/[^A-Za-z0-9._-]+/g, "-");

const repoName = (url: string): string =>
    basename(url.replace(/\/+$/, "")).replace(/\.git$/, "");

const cacheKey = ({ url, version }: GitTheme): string => {
    const hash = createHash("sha256")
        .update(`${url}\n${version}`)
        .digest("hex")
        .slice(0, 12);
    return `${safeSegment(repoName(url))}-${safeSegment(version)}-${hash}`;
};

const unreachableMessage = (
    theme: GitTheme,
    cacheDir: string,
    detail: string
): string =>
    [
        `Could not fetch theme ${theme.url} at ${theme.version}:`,
        detail.trim(),
        `Nothing is cached for it in ${cacheDir}, so the build cannot continue offline. Check the URL and the network connection, or build once online to fill the cache.`,
    ].join("\n");

const git = async (
    theme: GitTheme,
    cacheDir: string,
    args: string[],
    cwd: string
): Promise<string> => {
    const result = await captureCommand("git", args, cwd, gitEnvironment);
    if (result.exitCode !== 0) {
        throw new NefantarisError(
            unreachableMessage(theme, cacheDir, result.stderr)
        );
    }
    return result.stdout;
};

const remoteTags = async (
    theme: GitTheme,
    cacheDir: string
): Promise<string[]> => {
    const listing = await git(
        theme,
        cacheDir,
        ["ls-remote", "--tags", "--refs", theme.url],
        cacheDir
    );
    return listing
        .split("\n")
        .map((line) => line.split("\t")[1] ?? "")
        .filter((ref) => ref.startsWith("refs/tags/"))
        .map((ref) => ref.slice("refs/tags/".length));
};

const remoteRefFor = async (
    theme: GitTheme,
    cacheDir: string
): Promise<string> => {
    if (fullShaPattern.test(theme.version)) {
        return theme.version;
    }
    const tags = await remoteTags(theme, cacheDir);
    if (tags.includes(theme.version)) {
        return `refs/tags/${theme.version}`;
    }
    const available = tags.length === 0 ? "none" : tags.join(", ");
    throw new NefantarisError(
        `${theme.url} has no tag "${theme.version}" — "theme.version" must be a tag or a full commit SHA. Tags available: ${available}`
    );
};

const snapshotInto = async (
    theme: GitTheme,
    cacheDir: string,
    remoteRef: string,
    stagingDir: string
): Promise<void> => {
    const run = (args: string[]): Promise<string> =>
        git(theme, cacheDir, args, stagingDir);
    await run(["init", "--quiet"]);
    await run(["remote", "add", "origin", theme.url]);
    await run(["fetch", "--quiet", "--depth", "1", "origin", remoteRef]);
    await run([
        "-c",
        "advice.detachedHead=false",
        "checkout",
        "--quiet",
        "FETCH_HEAD",
    ]);
    await rm(join(stagingDir, ".git"), { recursive: true, force: true });
};

const fetchTheme = async (
    theme: GitTheme,
    cacheDir: string,
    target: string
): Promise<void> => {
    await mkdir(cacheDir, { recursive: true });
    const remoteRef = await remoteRefFor(theme, cacheDir);
    console.error(`Fetching theme ${theme.url} at ${theme.version}`);
    const stagingDir = `${target}.tmp-${String(process.pid)}`;
    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });
    try {
        await snapshotInto(theme, cacheDir, remoteRef, stagingDir);
        await rename(stagingDir, target);
    } catch (error) {
        await rm(stagingDir, { recursive: true, force: true });
        if (!existsSync(target)) {
            throw error;
        }
    }
};

export const resolveThemeDir = async (
    siteDir: string,
    theme: ThemeReference
): Promise<string> => {
    if (theme.kind === "local") {
        return resolve(siteDir, theme.path);
    }
    const cacheDir = themeCacheDir(siteDir);
    const target = join(cacheDir, cacheKey(theme));
    if (!existsSync(target)) {
        await fetchTheme(theme, cacheDir, target);
    }
    return target;
};
