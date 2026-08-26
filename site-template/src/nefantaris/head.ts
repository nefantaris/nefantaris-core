import { routes, site } from "../generated/content";
import type { RouteEntry } from "./types";

export type HeadData = { title: string; description?: string };

const routesByPath = new Map(routes.map((entry) => [entry.path, entry]));

export const normalizePath = (path: string): string => {
    if (path.length > 1 && path.endsWith("/")) {
        return path.slice(0, -1);
    }
    return path;
};

export const routeForPath = (path: string): RouteEntry | undefined =>
    routesByPath.get(normalizePath(path));

export const headForPath = (path: string): HeadData => {
    const entry = routeForPath(path);
    if (!entry) {
        return { title: `Page not found — ${site.name}` };
    }
    if (entry.path === "/") {
        return { title: site.name, description: entry.meta.description };
    }
    return {
        title: `${entry.meta.title} — ${site.name}`,
        description: entry.meta.description,
    };
};

export const applyHead = (head: HeadData): void => {
    document.title = head.title;
    const meta = document.querySelector('meta[name="description"]');
    if (head.description === undefined) {
        meta?.remove();
        return;
    }
    if (meta) {
        meta.setAttribute("content", head.description);
        return;
    }
    const created = document.createElement("meta");
    created.setAttribute("name", "description");
    created.setAttribute("content", head.description);
    document.head.append(created);
};
