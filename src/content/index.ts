import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { NefantarisError } from "../NefantarisError.js";
import { parseMarkdown } from "./markdown.js";
import type {
    PageMeta,
    PostSummary,
    RouteEntry,
    TemplateName,
} from "./types.js";

export type SiteContent = {
    routes: RouteEntry[];
    posts: PostSummary[];
};

const collectMarkdownFiles = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, {
        recursive: true,
        withFileTypes: true,
    });
    return entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
        .map((entry) => join(entry.parentPath, entry.name))
        .sort();
};

const readOptionalString = (
    frontmatter: Record<string, unknown>,
    key: "description" | "date" | "slug" | "template",
    filePath: string
): string | undefined => {
    const value = frontmatter[key];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new NefantarisError(
            `${filePath}: frontmatter "${key}" must be a string`
        );
    }
    return value;
};

const readMeta = (
    frontmatter: Record<string, unknown>,
    filePath: string
): PageMeta => {
    const { title, draft } = frontmatter;
    if (typeof title !== "string" || title === "") {
        throw new NefantarisError(
            `${filePath}: frontmatter "title" is required and must be a non-empty string`
        );
    }
    if (draft !== undefined && typeof draft !== "boolean") {
        throw new NefantarisError(
            `${filePath}: frontmatter "draft" must be a boolean`
        );
    }
    const meta: PageMeta = { title };
    const description = readOptionalString(
        frontmatter,
        "description",
        filePath
    );
    const date = readOptionalString(frontmatter, "date", filePath);
    const slug = readOptionalString(frontmatter, "slug", filePath);
    const template = readOptionalString(frontmatter, "template", filePath);
    if (description !== undefined) meta.description = description;
    if (date !== undefined) meta.date = date;
    if (slug !== undefined) meta.slug = slug;
    if (template !== undefined) meta.template = template;
    if (draft !== undefined) meta.draft = draft;
    return meta;
};

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

const routeFromPagePath = (pagesDir: string, filePath: string): string => {
    const segments = relative(pagesDir, filePath).slice(0, -3).split(sep);
    if (segments.at(-1) === "index") {
        segments.pop();
    }
    return `/${segments.join("/")}`;
};

const resolvePageTemplate = (
    meta: PageMeta,
    route: string,
    filePath: string
): TemplateName => {
    if (meta.template === undefined) {
        return route === "/" ? "home" : "page";
    }
    if (
        meta.template === "home" ||
        meta.template === "page" ||
        meta.template === "post" ||
        meta.template === "blogIndex"
    ) {
        return meta.template;
    }
    throw new NefantarisError(
        `${filePath}: unknown template "${meta.template}" (expected home, page, post, or blogIndex)`
    );
};

const assertUniqueRoutes = (routes: RouteEntry[]): void => {
    const seen = new Set<string>();
    for (const route of routes) {
        if (seen.has(route.path)) {
            throw new NefantarisError(
                `Duplicate route "${route.path}" — two content files resolve to the same route`
            );
        }
        seen.add(route.path);
    }
};

const parsePages = async (pagesDir: string): Promise<RouteEntry[]> => {
    const routes: RouteEntry[] = [];
    for (const filePath of await collectMarkdownFiles(pagesDir)) {
        const source = await readFile(filePath, "utf8");
        const { frontmatter, body } = parseMarkdown(source, filePath);
        const meta = readMeta(frontmatter, filePath);
        if (meta.draft === true) {
            continue;
        }
        const path =
            meta.slug === undefined
                ? routeFromPagePath(pagesDir, filePath)
                : `/${trimSlashes(meta.slug)}`;
        routes.push({
            path,
            template: resolvePageTemplate(meta, path, filePath),
            meta,
            body,
        });
    }
    return routes;
};

const parsePosts = async (postsDir: string): Promise<SiteContent> => {
    const routes: RouteEntry[] = [];
    const posts: PostSummary[] = [];
    for (const filePath of await collectMarkdownFiles(postsDir)) {
        const source = await readFile(filePath, "utf8");
        const { frontmatter, body } = parseMarkdown(source, filePath);
        const meta = readMeta(frontmatter, filePath);
        if (meta.template !== undefined) {
            throw new NefantarisError(
                `${filePath}: "template" is only supported on pages`
            );
        }
        if (meta.draft === true) {
            continue;
        }
        if (meta.date === undefined) {
            throw new NefantarisError(
                `${filePath}: posts require a "date" in frontmatter`
            );
        }
        if (Number.isNaN(Date.parse(meta.date))) {
            throw new NefantarisError(
                `${filePath}: invalid post date "${meta.date}"`
            );
        }
        const slug =
            meta.slug === undefined
                ? basename(filePath, ".md")
                : trimSlashes(meta.slug);
        const path = `/blog/${slug}`;
        routes.push({ path, template: "post", meta, body });
        const summary: PostSummary = {
            route: path,
            title: meta.title,
            date: meta.date,
        };
        if (meta.description !== undefined) {
            summary.description = meta.description;
        }
        posts.push(summary);
    }
    posts.sort(
        (a, b) =>
            Date.parse(b.date) - Date.parse(a.date) ||
            a.route.localeCompare(b.route)
    );
    return { routes, posts };
};

export const parseSiteContent = async (
    siteDir: string
): Promise<SiteContent> => {
    const pagesDir = join(siteDir, "content", "pages");
    const postsDir = join(siteDir, "content", "posts");
    if (!existsSync(pagesDir)) {
        throw new NefantarisError(`${siteDir} has no content/pages directory`);
    }
    const routes = await parsePages(pagesDir);
    const posts: PostSummary[] = [];
    if (existsSync(postsDir)) {
        const parsed = await parsePosts(postsDir);
        routes.push(...parsed.routes);
        posts.push(...parsed.posts);
        routes.push({
            path: "/blog",
            template: "blogIndex",
            meta: { title: "Blog" },
            body: [],
        });
    }
    routes.sort((a, b) => a.path.localeCompare(b.path));
    assertUniqueRoutes(routes);
    return { routes, posts };
};
