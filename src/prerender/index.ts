import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { RouteEntry } from "../content/types.js";
import { NefantarisError } from "../NefantarisError.js";
import { isRecord } from "../narrow.js";
import { runTool } from "../tools.js";

type RenderOutput = { appHtml: string; title: string; description?: string };

type RenderFunction = (path: string) => RenderOutput;

type PrerenderOptions = {
    nefantarisDir: string;
    distDir: string;
    routes: RouteEntry[];
};

const notFoundRenderPath = "/__nefantaris_not_found__";

export const runViteBuilds = async (
    nefantarisDir: string,
    distDir: string
): Promise<void> => {
    await runTool(
        nefantarisDir,
        "vite",
        ["build", "--outDir", distDir, "--emptyOutDir"],
        nefantarisDir
    );
    await runTool(
        nefantarisDir,
        "vite",
        ["build", "--ssr", "src/entry-server.tsx", "--outDir", "dist-server"],
        nefantarisDir
    );
};

const loadRenderFunction = async (
    nefantarisDir: string
): Promise<RenderFunction> => {
    const bundlePath = join(nefantarisDir, "dist-server", "entry-server.js");
    const bundle: unknown = await import(pathToFileURL(bundlePath).href);
    if (!isRecord(bundle)) {
        throw new NefantarisError(`${bundlePath} is not a module`);
    }
    const render = bundle.render;
    if (typeof render !== "function") {
        throw new NefantarisError(
            `${bundlePath} does not export a render function`
        );
    }
    return (path) => {
        const output: unknown = render(path);
        if (
            !isRecord(output) ||
            typeof output.appHtml !== "string" ||
            typeof output.title !== "string"
        ) {
            throw new NefantarisError(
                `render("${path}") returned an unexpected shape`
            );
        }
        const { appHtml, title, description } = output;
        if (description === undefined) {
            return { appHtml, title };
        }
        if (typeof description !== "string") {
            throw new NefantarisError(
                `render("${path}") returned a non-string description`
            );
        }
        return { appHtml, title, description };
    };
};

const escapeHtml = (value: string): string =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

const headHtml = ({ title, description }: RenderOutput): string => {
    const titleTag = `<title>${escapeHtml(title)}</title>`;
    if (description === undefined) {
        return titleTag;
    }
    return `${titleTag}\n        <meta name="description" content="${escapeHtml(description)}" />`;
};

const outputPathForRoute = (distDir: string, route: string): string =>
    route === "/"
        ? join(distDir, "index.html")
        : join(distDir, route.slice(1), "index.html");

export const prerenderRoutes = async ({
    nefantarisDir,
    distDir,
    routes,
}: PrerenderOptions): Promise<void> => {
    const render = await loadRenderFunction(nefantarisDir);
    const template = await readFile(join(distDir, "index.html"), "utf8");
    const writeRendered = async (
        routePath: string,
        outputPath: string
    ): Promise<void> => {
        let output: RenderOutput;
        try {
            output = render(routePath);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            throw new NefantarisError(
                `Failed to prerender ${routePath}: ${message}`
            );
        }
        const html = template
            .replace("<!--app-head-->", headHtml(output))
            .replace("<!--app-html-->", output.appHtml);
        await mkdir(dirname(outputPath), { recursive: true });
        await writeFile(outputPath, html);
    };
    for (const route of routes) {
        await writeRendered(
            route.path,
            outputPathForRoute(distDir, route.path)
        );
    }
    await writeRendered(notFoundRenderPath, join(distDir, "404.html"));
};
