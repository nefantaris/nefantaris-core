import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { NefantarisError } from "./NefantarisError.js";

type SpawnPlan = { command: string; args: string[] };

const npmCliEntries = { npm: "npm-cli.js", npx: "npx-cli.js" };

type NpmCommand = keyof typeof npmCliEntries;

const isNpmCommand = (command: string): command is NpmCommand =>
    Object.hasOwn(npmCliEntries, command);

const npmCliDirs = (): string[] => {
    const npmExecPath = process.env.npm_execpath;
    const fromNpmExecPath = npmExecPath ? [dirname(npmExecPath)] : [];
    const besideNode = join(
        dirname(process.execPath),
        "node_modules",
        "npm",
        "bin"
    );
    return [...fromNpmExecPath, besideNode];
};

const locateNpmCli = (command: NpmCommand): string => {
    const entry = npmCliDirs()
        .map((dir) => join(dir, npmCliEntries[command]))
        .find((candidate) => existsSync(candidate));
    if (entry === undefined) {
        throw new NefantarisError(
            `Could not find ${command} next to ${process.execPath}`
        );
    }
    return entry;
};

const windowsSafe = (command: string, args: string[]): SpawnPlan => {
    if (process.platform !== "win32" || !isNpmCommand(command)) {
        return { command, args };
    }
    return {
        command: process.execPath,
        args: [locateNpmCli(command), ...args],
    };
};

export const runCommand = (
    command: string,
    args: string[],
    cwd: string
): Promise<void> =>
    new Promise((resolvePromise, rejectPromise) => {
        const plan = windowsSafe(command, args);
        const child = spawn(plan.command, plan.args, { cwd, stdio: "inherit" });
        child.on("error", rejectPromise);
        child.on("exit", (code, signal) => {
            if (code === 0 || signal !== null) {
                resolvePromise();
                return;
            }
            rejectPromise(
                new NefantarisError(
                    `${command} ${args.join(" ")} failed with exit code ${String(code)}`
                )
            );
        });
    });

export type CapturedCommand = {
    exitCode: number;
    stdout: string;
    stderr: string;
};

const isMissingExecutable = (error: NodeJS.ErrnoException): boolean =>
    error.code === "ENOENT";

export const captureCommand = (
    command: string,
    args: string[],
    cwd: string,
    env: Record<string, string> = {}
): Promise<CapturedCommand> =>
    new Promise((resolvePromise, rejectPromise) => {
        const plan = windowsSafe(command, args);
        const child = spawn(plan.command, plan.args, {
            cwd,
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, ...env },
        });
        let stdout = "";
        let stderr = "";
        child.stdout.setEncoding("utf8");
        child.stderr.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
            stdout += chunk;
        });
        child.stderr.on("data", (chunk: string) => {
            stderr += chunk;
        });
        child.on("error", (error: NodeJS.ErrnoException) => {
            rejectPromise(
                isMissingExecutable(error)
                    ? new NefantarisError(
                          `${command} is not installed or not on PATH`
                      )
                    : error
            );
        });
        child.on("exit", (code) => {
            resolvePromise({ exitCode: code ?? 1, stdout, stderr });
        });
    });
