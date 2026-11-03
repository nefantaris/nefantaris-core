#!/usr/bin/env node
import { resolve } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { enablePlugin } from "../plugins/enable.js";
import { runBuild } from "./build.js";
import { runDev } from "./dev.js";
import { runDoctor } from "./doctor.js";
import { runEject } from "./eject.js";
import { runInit } from "./init.js";
import { runInspect } from "./inspect.js";
import { runThemeCheck } from "./themeCheck.js";
import { runThemeDev } from "./themeDev.js";

const usage = [
    "Usage:",
    "    nef build [siteDir]",
    "    nef dev [siteDir] [viteArgs...]",
    "    nef doctor [siteDir] [--json]",
    "    nef eject [siteDir] [--out <dir>]",
    "    nef init [siteDir] [--theme <source>] [--theme-version <ref>] [--name <site name>]",
    "    nef inspect [siteDir] --json",
    "    nef theme dev [themeDir] [viteArgs...]",
    "    nef theme check [themeDir]",
    "    nef plugins add <name> [siteDir] [--source <url|path>] [--version <ref>]",
].join("\n");

type DirAndPassthroughArgs = { dirArg: string; passthroughArgs: string[] };

type ArgSpec = {
    options?: string[];
    flags?: string[];
};

type ParsedArgs = {
    dirArg: string | undefined;
    options: Record<string, string>;
    flags: Set<string>;
};

const fail = (message: string): never => {
    console.error(message);
    process.exit(1);
};

const splitDirAndPassthroughArgs = (args: string[]): DirAndPassthroughArgs => {
    const [first, ...rest] = args;
    if (first === undefined || first.startsWith("-")) {
        return { dirArg: ".", passthroughArgs: args };
    }
    return { dirArg: first, passthroughArgs: rest };
};

const parseArgs = (
    args: string[],
    { options: allowedOptions = [], flags: allowedFlags = [] }: ArgSpec
): ParsedArgs => {
    let dirArg: string | undefined;
    const options: Record<string, string> = {};
    const flags = new Set<string>();
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (allowedOptions.includes(arg)) {
            const value = args[index + 1];
            if (options[arg] !== undefined || value === undefined) {
                fail(usage);
            }
            options[arg] = value;
            index += 1;
        } else if (allowedFlags.includes(arg)) {
            if (flags.has(arg)) {
                fail(usage);
            }
            flags.add(arg);
        } else if (dirArg === undefined && !arg.startsWith("--")) {
            dirArg = arg;
        } else {
            fail(usage);
        }
    }
    return { dirArg, options, flags };
};

const runInitCommand = async (args: string[]): Promise<void> => {
    const { dirArg, options } = parseArgs(args, {
        options: ["--theme", "--theme-version", "--name"],
    });
    await runInit(
        dirArg ?? ".",
        options["--theme"],
        options["--theme-version"],
        options["--name"]
    );
};

const runEjectCommand = async (args: string[]): Promise<void> => {
    const { dirArg, options } = parseArgs(args, { options: ["--out"] });
    await runEject(dirArg ?? ".", options["--out"]);
};

const runThemeCommand = async (args: string[]): Promise<void> => {
    const [subcommand, ...rest] = args;
    if (subcommand === "dev") {
        const { dirArg, passthroughArgs } = splitDirAndPassthroughArgs(rest);
        await runThemeDev(dirArg, passthroughArgs);
        return;
    }
    if (subcommand === "check") {
        await runThemeCheck(rest[0] ?? ".");
        return;
    }
    fail(usage);
};

const runPluginsCommand = async (args: string[]): Promise<void> => {
    const [subcommand, name, ...rest] = args;
    if (subcommand !== "add" || name === undefined || name.startsWith("-")) {
        fail(usage);
        return;
    }
    const { dirArg, options } = parseArgs(rest, {
        options: ["--source", "--version"],
    });
    await enablePlugin(
        resolve(process.cwd(), dirArg ?? "."),
        name,
        options["--source"],
        options["--version"]
    );
};

const runInspectCommand = async (args: string[]): Promise<void> => {
    const { dirArg, flags } = parseArgs(args, { flags: ["--json"] });
    if (!flags.has("--json")) {
        fail(usage);
    }
    await runInspect(dirArg ?? ".");
};

const runDoctorCommand = async (args: string[]): Promise<void> => {
    const { dirArg, flags } = parseArgs(args, { flags: ["--json"] });
    await runDoctor(dirArg ?? ".", flags.has("--json"));
};

const [command, ...args] = process.argv.slice(2);

try {
    if (command === "build") {
        await runBuild(args[0] ?? ".");
    } else if (command === "dev") {
        const { dirArg, passthroughArgs } = splitDirAndPassthroughArgs(args);
        await runDev(dirArg, passthroughArgs);
    } else if (command === "init") {
        await runInitCommand(args);
    } else if (command === "inspect") {
        await runInspectCommand(args);
    } else if (command === "doctor") {
        await runDoctorCommand(args);
    } else if (command === "theme") {
        await runThemeCommand(args);
    } else if (command === "plugins") {
        await runPluginsCommand(args);
    } else if (command === "eject") {
        await runEjectCommand(args);
    } else {
        fail(usage);
    }
} catch (error) {
    if (error instanceof NefantarisError) {
        console.error(error.message);
        process.exit(1);
    }
    throw error;
}
