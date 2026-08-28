import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { pluginAliases, pluginRoots } from "./src/generated/plugins.ts";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            nefantaris: fileURLToPath(
                new URL("src/nefantaris/types.ts", import.meta.url)
            ),
            ...pluginAliases,
        },
        dedupe: ["react", "react-dom"],
    },
    server: {
        fs: {
            allow: [
                fileURLToPath(new URL(".", import.meta.url)),
                ...pluginRoots,
            ],
        },
    },
});
