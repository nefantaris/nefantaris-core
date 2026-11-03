import { routes, site } from "../generated/content";
import {
    applyHeadTags,
    headTagsFor,
    renderHeadTags,
    type HeadTag,
} from "./headTags";
import type { RouteEntry } from "./types";

const routesByPath = new Map(routes.map((entry) => [entry.path, entry]));

export const normalizePath = (path: string): string => {
    if (path.length > 1 && path.endsWith("/")) {
        return path.slice(0, -1);
    }
    return path;
};

export const routeForPath = (path: string): RouteEntry | undefined =>
    routesByPath.get(normalizePath(path));

const headTagsForPath = (path: string): HeadTag[] =>
    headTagsFor(site, routeForPath(path));

export const renderHead = (path: string): string =>
    renderHeadTags(headTagsForPath(path));

export const applyHead = (path: string): void => {
    applyHeadTags(headTagsForPath(path));
};
