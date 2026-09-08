import { join } from "node:path";
import { readManifestObject } from "./manifest.js";
import { NefantarisError } from "./NefantarisError.js";
import { packageRoot } from "./paths.js";

export const readCoreVersion = async (): Promise<string> => {
    const packageJsonPath = join(packageRoot, "package.json");
    const { version } = await readManifestObject(
        packageJsonPath,
        `Could not read ${packageJsonPath}`
    );
    if (typeof version !== "string" || version === "") {
        throw new NefantarisError(
            `${packageJsonPath}: "version" must be a non-empty string`
        );
    }
    return version;
};
