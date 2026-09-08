import { join } from "node:path";
import { runCommand } from "./run.js";

const toolEntries = {
    eslint: ["eslint", "bin", "eslint.js"],
    prettier: ["prettier", "bin", "prettier.cjs"],
    tsc: ["typescript", "bin", "tsc"],
    vite: ["vite", "bin", "vite.js"],
};

export type ToolName = keyof typeof toolEntries;

export const toolEntryPath = (workDir: string, tool: ToolName): string =>
    join(workDir, "node_modules", ...toolEntries[tool]);

export const runTool = (
    workDir: string,
    tool: ToolName,
    args: string[],
    cwd: string
): Promise<void> =>
    runCommand(process.execPath, [toolEntryPath(workDir, tool), ...args], cwd);
