import { execFile, type ExecFileException } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const coreDir = fileURLToPath(new URL("..", import.meta.url));

const tsxCli = join(coreDir, "node_modules", "tsx", "dist", "cli.mjs");
const nefEntry = join(coreDir, "src", "cli", "index.ts");
const outputLimit = 64 * 1024 * 1024;

export type CommandResult = {
    exitCode: number;
    stdout: string;
    stderr: string;
};

type FailedExecution = ExecFileException & { stdout: string; stderr: string };

const run = async (
    command: string,
    args: string[],
    cwd: string
): Promise<CommandResult> => {
    try {
        const { stdout, stderr } = await execFileAsync(command, args, {
            cwd,
            maxBuffer: outputLimit,
        });
        return { exitCode: 0, stdout, stderr };
    } catch (error) {
        const failed = error as FailedExecution;
        return {
            exitCode: typeof failed.code === "number" ? failed.code : 1,
            stdout: failed.stdout,
            stderr: failed.stderr,
        };
    }
};

export const runNef = (
    args: string[],
    cwd: string = coreDir
): Promise<CommandResult> =>
    run(process.execPath, [tsxCli, nefEntry, ...args], cwd);

export const runNpm = (args: string[], cwd: string): Promise<CommandResult> =>
    run("npm", args, cwd);

export const runGit = (args: string[], cwd: string): Promise<CommandResult> =>
    run("git", args, cwd);
