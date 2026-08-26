import { spawn } from "node:child_process";
import { NefantarisError } from "./NefantarisError.js";

export const runCommand = (
    command: string,
    args: string[],
    cwd: string
): Promise<void> =>
    new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, { cwd, stdio: "inherit" });
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
