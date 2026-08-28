import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fixtureDistDir, previewBaseUrl, previewPort } from "./fixtureSite";

const contentTypes: Record<string, string> = {
    ".css": "text/css",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
};

const notFoundPage = join(fixtureDistDir, "404.html");

if (!existsSync(notFoundPage)) {
    console.error(
        `${fixtureDistDir} has no 404.html — run "npm run build:fixture" first`
    );
    process.exit(1);
}

const resolveFile = (urlPath: string): string | undefined => {
    const relativePath = normalize(decodeURIComponent(urlPath)).replace(
        /^(\.\.[/\\])+/,
        ""
    );
    const direct = join(fixtureDistDir, relativePath);
    if (existsSync(direct) && statSync(direct).isFile()) {
        return direct;
    }
    const asDirectoryIndex = join(direct, "index.html");
    if (existsSync(asDirectoryIndex)) {
        return asDirectoryIndex;
    }
    return undefined;
};

createServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", previewBaseUrl);
    const filePath = resolveFile(pathname);
    const bodyPath = filePath ?? notFoundPage;
    response.writeHead(filePath === undefined ? 404 : 200, {
        "cache-control": "no-store",
        "content-type":
            contentTypes[extname(bodyPath)] ?? "application/octet-stream",
    });
    createReadStream(bodyPath).pipe(response);
}).listen(previewPort, () => {
    console.log(`serving ${fixtureDistDir} on ${previewBaseUrl}`);
});
