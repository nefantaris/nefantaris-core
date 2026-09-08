import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const projectDir = fileURLToPath(new URL("..", import.meta.url));
const distDir = resolve(projectDir, process.argv[2] ?? "dist");
const serverDir = join(projectDir, "dist-server");
const serverEntryFile = "src/entry-server.tsx";
const notFoundRenderPath = "/__nefantaris_not_found__";

const escapeHtml = (value) =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

const headHtml = ({ title, description }) => {
    const titleTag = `<title>${escapeHtml(title)}</title>`;
    if (description === undefined) {
        return titleTag;
    }
    return `${titleTag}\n        <meta name="description" content="${escapeHtml(description)}" />`;
};

const outputPathForRoute = (routePath) =>
    routePath === "/"
        ? join(distDir, "index.html")
        : join(distDir, routePath.slice(1), "index.html");

const loadServerEntry = async () => {
    const entryPath = join(serverDir, "entry-server.js");
    const entry = await import(pathToFileURL(entryPath).href);
    if (
        typeof entry.render !== "function" ||
        !Array.isArray(entry.routePaths)
    ) {
        throw new Error(`${entryPath} must export render() and routePaths`);
    }
    return entry;
};

const renderRoute = (render, routePath) => {
    try {
        return render(routePath);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to prerender ${routePath}: ${message}`);
    }
};

const prerender = async () => {
    const { render, routePaths } = await loadServerEntry();
    const template = await readFile(join(distDir, "index.html"), "utf8");
    const writeRendered = async (routePath, outputPath) => {
        const output = renderRoute(render, routePath);
        const html = template
            .replace("<!--app-head-->", headHtml(output))
            .replace("<!--app-html-->", output.appHtml);
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, html);
    };
    for (const routePath of routePaths) {
        await writeRendered(routePath, outputPathForRoute(routePath));
    }
    await writeRendered(notFoundRenderPath, join(distDir, "404.html"));
    console.log(
        `Prerendered ${String(routePaths.length)} routes (plus 404.html) to ${distDir}`
    );
};

const buildSite = async () => {
    await build({
        root: projectDir,
        build: { outDir: distDir, emptyOutDir: true },
    });
    await build({
        root: projectDir,
        build: { ssr: serverEntryFile, outDir: serverDir, emptyOutDir: true },
    });
    await prerender();
};

try {
    await buildSite();
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
}
