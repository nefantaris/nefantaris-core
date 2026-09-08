#!/usr/bin/env node
import { resolve } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { enablePlugin } from "../plugins/enable.js";
import { runBuild } from "./build.js";
import { runDev } from "./dev.js";
import { runInit } from "./init.js";
import { runInspect } from "./inspect.js";
import { runThemeCheck } from "./themeCheck.js";
import { runThemeDev } from "./themeDev.js";

const usage = [
    "Usage:",
    "    nef build [siteDir]",
    "    nef dev [siteDir] [viteArgs...]",
    "    nef eject [siteDir]",
    "    nef init [siteDir] [--theme <source>]",
    "    nef inspect [siteDir] --json",
    "    nef theme dev [themeDir] [viteArgs...]",
    "    nef theme check [themeDir]",
    "    nef plugins add <name> [siteDir]",
].join("\n");

type DirAndPassthroughArgs = { dirArg: string; passthroughArgs: string[] };

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

const runInitCommand = async (args: string[]): Promise<void> => {
    let siteDirArg: string | undefined;
    let themeSource: string | undefined;
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === "--theme") {
            const value = args[index + 1];
            if (themeSource !== undefined || value === undefined) {
                fail(usage);
            }
            themeSource = value;
            index += 1;
        } else if (siteDirArg === undefined && !arg.startsWith("--")) {
            siteDirArg = arg;
        } else {
            fail(usage);
        }
    }
    await runInit(siteDirArg ?? ".", themeSource);
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
    const [subcommand, name, siteDirArg] = args;
    if (subcommand === "add" && name !== undefined) {
        await enablePlugin(resolve(process.cwd(), siteDirArg ?? "."), name);
        return;
    }
    fail(usage);
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
        const [siteDirArg, formatFlag] = args;
        if (formatFlag !== "--json") {
            fail(usage);
        }
        await runInspect(siteDirArg ?? ".");
    } else if (command === "theme") {
        await runThemeCommand(args);
    } else if (command === "plugins") {
        await runPluginsCommand(args);
    } else if (command === "eject") {
        fail("nef eject is not implemented yet");
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
