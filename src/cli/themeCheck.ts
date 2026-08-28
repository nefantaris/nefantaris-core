import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCommand } from "../run.js";
import { collectThemeFiles, withExtensions } from "../themes/files.js";
import {
    assertNoUndeclaredImports,
    findUndeclaredImports,
} from "../themes/imports.js";
import { prepareThemeWorkspace } from "../themes/workspace.js";

const prettierConfigFileName = "prettier.config.json";

const prettierConfig = `${JSON.stringify(
    {
        tabWidth: 4,
        trailingComma: "es5",
        plugins: [
            "prettier-plugin-organize-imports",
            "prettier-plugin-tailwindcss",
        ],
    },
    null,
    4
)}\n`;

const binPath = (workDir: string, name: string): string =>
    join(workDir, "node_modules", ".bin", name);

export const runThemeCheck = async (themeDirArg: string): Promise<void> => {
    const { themeDir, workDir, manifest, plugins } =
        await prepareThemeWorkspace(themeDirArg);
    const files = await collectThemeFiles(themeDir);
    const sourceFiles = withExtensions(files, [".ts", ".tsx"]);
    const pluginPackages = plugins.plugins.flatMap((plugin) =>
        Object.keys(plugin.dependencies)
    );

    assertNoUndeclaredImports(
        manifest,
        await findUndeclaredImports(themeDir, sourceFiles, pluginPackages)
    );

    await runCommand(
        binPath(workDir, "tsc"),
        ["--noEmit", "--project", join(themeDir, "tsconfig.json")],
        themeDir
    );
    await runCommand(
        binPath(workDir, "tsc"),
        ["--noEmit", "--project", join(workDir, "tsconfig.json")],
        workDir
    );
    await runCommand(
        binPath(workDir, "eslint"),
        [
            "--no-config-lookup",
            "--config",
            join(workDir, "eslint.config.js"),
            ...sourceFiles,
        ],
        themeDir
    );

    const prettierConfigPath = join(workDir, prettierConfigFileName);
    await writeFile(prettierConfigPath, prettierConfig);
    await runCommand(
        binPath(workDir, "prettier"),
        [
            "--check",
            "--config",
            prettierConfigPath,
            ...withExtensions(files, [".ts", ".tsx", ".css", ".json", ".md"]),
        ],
        themeDir
    );

    console.log(`Theme "${manifest.name}" passes nef theme check`);
};
