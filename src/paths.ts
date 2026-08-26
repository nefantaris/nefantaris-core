import { fileURLToPath } from "node:url";

export const templateDir = fileURLToPath(
    new URL("../site-template", import.meta.url)
);
