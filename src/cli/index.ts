#!/usr/bin/env node
import { NefantarisError } from "../NefantarisError.js";
import { runBuild } from "./build.js";
import { runDev } from "./dev.js";

const commands = ["build", "dev", "eject"];
const [command, siteDirArg, ...extraArgs] = process.argv.slice(2);

if (!command || !commands.includes(command)) {
    console.error(`Usage: nef <${commands.join("|")}> [siteDir]`);
    process.exit(1);
}

if (command === "eject") {
    console.error("nef eject is not implemented yet");
    process.exit(1);
}

try {
    if (command === "build") {
        await runBuild(siteDirArg ?? ".");
    } else {
        await runDev(siteDirArg ?? ".", extraArgs);
    }
} catch (error) {
    if (error instanceof NefantarisError) {
        console.error(error.message);
        process.exit(1);
    }
    throw error;
}
