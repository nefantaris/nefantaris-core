import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const packageRoot = fileURLToPath(new URL("..", import.meta.url));

export const templateDir = join(packageRoot, "site-template");

export const contractTypesPath = join(
    templateDir,
    "src",
    "nefantaris",
    "types.ts"
);

export const pluginStoreDir = join(packageRoot, ".plugin-store");

export const fixtureSiteDir = join(packageRoot, "fixtures", "demo-site");
