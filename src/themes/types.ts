import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { contractTypesPath } from "../paths.js";

export const themeWorkDirName = ".nefantaris";
export const contractModuleName = "nefantaris";

const contractTypesFileName = "types.ts";

const themeTsconfig = (pluginPaths: Record<string, string[]>): string =>
    `${JSON.stringify(
        {
            compilerOptions: {
                target: "ES2023",
                lib: ["ES2023", "DOM", "DOM.Iterable"],
                module: "ESNext",
                moduleResolution: "bundler",
                moduleDetection: "force",
                isolatedModules: true,
                jsx: "react-jsx",
                strict: true,
                noUnusedLocals: true,
                noUnusedParameters: true,
                noFallthroughCasesInSwitch: true,
                noEmit: true,
                skipLibCheck: true,
                paths: {
                    [contractModuleName]: [
                        `./${themeWorkDirName}/${contractTypesFileName}`,
                    ],
                    ...pluginPaths,
                },
            },
            include: ["**/*.ts", "**/*.tsx"],
            exclude: [themeWorkDirName, "node_modules"],
        },
        null,
        4
    )}\n`;

export const writeThemeTypes = async (
    themeDir: string,
    pluginPaths: Record<string, string[]> = {}
): Promise<void> => {
    const workDir = join(themeDir, themeWorkDirName);
    await mkdir(workDir, { recursive: true });
    await writeFile(
        join(workDir, contractTypesFileName),
        await readFile(contractTypesPath, "utf8")
    );
    await writeFile(
        join(themeDir, "tsconfig.json"),
        themeTsconfig(pluginPaths)
    );
};
