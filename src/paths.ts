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

export const fixtureSiteDir = join(packageRoot, "fixtures", "demo-site");

export const nefantarisDirName = ".nefantaris";

export const nefantarisDirFor = (siteDir: string): string =>
    join(siteDir, nefantarisDirName);
