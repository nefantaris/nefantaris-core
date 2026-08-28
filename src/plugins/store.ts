import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pluginStoreDir } from "../paths.js";
import { runCommand } from "../run.js";

const storePackageJson = (dependencies: Record<string, string>): string =>
    `${JSON.stringify(
        {
            name: "nefantaris-plugin-store",
            private: true,
            version: "0.0.0",
            type: "module",
            dependencies: Object.fromEntries(
                Object.entries(dependencies).sort(([first], [second]) =>
                    first.localeCompare(second)
                )
            ),
        },
        null,
        4
    )}\n`;

export const pluginPackagePath = (packageName: string): string =>
    join(pluginStoreDir, "node_modules", ...packageName.split("/"));

export const installPluginDependencies = async (
    dependencies: Record<string, string>
): Promise<void> => {
    if (Object.keys(dependencies).length === 0) {
        return;
    }
    await mkdir(pluginStoreDir, { recursive: true });
    const packageJsonPath = join(pluginStoreDir, "package.json");
    const previous = existsSync(packageJsonPath)
        ? await readFile(packageJsonPath, "utf8")
        : undefined;
    const next = storePackageJson(dependencies);
    const isInstalled =
        existsSync(join(pluginStoreDir, "node_modules")) && previous === next;
    if (isInstalled) {
        return;
    }
    await writeFile(packageJsonPath, next);
    await runCommand(
        "npm",
        ["install", "--no-audit", "--no-fund"],
        pluginStoreDir
    );
};
