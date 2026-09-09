import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { nefantarisDirFor } from "../paths.js";
import { captureCommand } from "../run.js";
import type { SourceReference } from "./reference.js";

type GitSource = Extract<SourceReference, { kind: "git" }>;

export type SnapshotKind = {
    noun: string;
    cacheDirName: string;
    versionLabel: string;
};

const fullShaPattern = /^[0-9a-f]{40}$/;
const gitEnvironment = { GIT_TERMINAL_PROMPT: "0" };

export const snapshotCacheDir = (siteDir: string, kind: SnapshotKind): string =>
    join(nefantarisDirFor(siteDir), kind.cacheDirName);

const safeSegment = (value: string): string =>
    value.replace(/[^A-Za-z0-9._-]+/g, "-");

const repoName = (url: string): string =>
    basename(url.replace(/\/+$/, "")).replace(/\.git$/, "");

const cacheKey = ({ url, version }: GitSource): string => {
    const hash = createHash("sha256")
        .update(`${url}\n${version}`)
        .digest("hex")
        .slice(0, 12);
    return `${safeSegment(repoName(url))}-${safeSegment(version)}-${hash}`;
};

type Snapshot = {
    source: GitSource;
    kind: SnapshotKind;
    cacheDir: string;
};

const unreachableMessage = (
    { source, kind, cacheDir }: Snapshot,
    detail: string
): string =>
    [
        `Could not fetch ${kind.noun} ${source.url} at ${source.version}:`,
        detail.trim(),
        `Nothing is cached for it in ${cacheDir}, so the build cannot continue offline. Check the URL and the network connection, or build once online to fill the cache.`,
    ].join("\n");

const git = async (
    snapshot: Snapshot,
    args: string[],
    cwd: string
): Promise<string> => {
    const result = await captureCommand("git", args, cwd, gitEnvironment);
    if (result.exitCode !== 0) {
        throw new NefantarisError(unreachableMessage(snapshot, result.stderr));
    }
    return result.stdout;
};

const remoteTags = async (snapshot: Snapshot): Promise<string[]> => {
    const listing = await git(
        snapshot,
        ["ls-remote", "--tags", "--refs", snapshot.source.url],
        snapshot.cacheDir
    );
    return listing
        .split("\n")
        .map((line) => line.split("\t")[1] ?? "")
        .filter((ref) => ref.startsWith("refs/tags/"))
        .map((ref) => ref.slice("refs/tags/".length));
};

const remoteRefFor = async (snapshot: Snapshot): Promise<string> => {
    const { source, kind } = snapshot;
    if (fullShaPattern.test(source.version)) {
        return source.version;
    }
    const tags = await remoteTags(snapshot);
    if (tags.includes(source.version)) {
        return `refs/tags/${source.version}`;
    }
    const available = tags.length === 0 ? "none" : tags.join(", ");
    throw new NefantarisError(
        `${source.url} has no tag "${source.version}" — ${kind.versionLabel} must be a tag or a full commit SHA. Tags available: ${available}`
    );
};

const snapshotInto = async (
    snapshot: Snapshot,
    remoteRef: string,
    stagingDir: string
): Promise<void> => {
    const run = (args: string[]): Promise<string> =>
        git(snapshot, args, stagingDir);
    await run(["init", "--quiet"]);
    await run(["remote", "add", "origin", snapshot.source.url]);
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

const fetchSnapshot = async (
    snapshot: Snapshot,
    target: string
): Promise<void> => {
    const { source, kind, cacheDir } = snapshot;
    await mkdir(cacheDir, { recursive: true });
    const remoteRef = await remoteRefFor(snapshot);
    console.error(`Fetching ${kind.noun} ${source.url} at ${source.version}`);
    const stagingDir = `${target}.tmp-${String(process.pid)}`;
    await rm(stagingDir, { recursive: true, force: true });
    await mkdir(stagingDir, { recursive: true });
    try {
        await snapshotInto(snapshot, remoteRef, stagingDir);
        await rename(stagingDir, target);
    } catch (error) {
        await rm(stagingDir, { recursive: true, force: true });
        if (!existsSync(target)) {
            throw error;
        }
    }
};

export const resolveSourceDir = async (
    siteDir: string,
    source: SourceReference,
    kind: SnapshotKind
): Promise<string> => {
    if (source.kind === "local") {
        return resolve(siteDir, source.path);
    }
    const cacheDir = snapshotCacheDir(siteDir, kind);
    const target = join(cacheDir, cacheKey(source));
    if (!existsSync(target)) {
        await fetchSnapshot({ source, kind, cacheDir }, target);
    }
    return target;
};
