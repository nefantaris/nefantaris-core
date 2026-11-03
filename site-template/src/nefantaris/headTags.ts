import type { RouteEntry, SiteMeta } from "./types";

type TitleTag = { kind: "title"; text: string };

type MetaTag = {
    kind: "meta";
    attribute: "name" | "property";
    key: string;
    content: string;
};

export type HeadTag = TitleTag | MetaTag;

const headTagMarker = "data-nefantaris-head";

const headTagSeparator = "\n        ";

const titleFor = (site: SiteMeta, entry: RouteEntry | undefined): string => {
    if (entry === undefined) {
        return `Page not found — ${site.name}`;
    }
    if (entry.path === "/") {
        return site.name;
    }
    return `${entry.meta.title} — ${site.name}`;
};

export const headTagsFor = (
    site: SiteMeta,
    entry: RouteEntry | undefined
): HeadTag[] => {
    const tags: HeadTag[] = [{ kind: "title", text: titleFor(site, entry) }];
    const description = entry?.meta.description;
    if (description !== undefined) {
        tags.push({
            kind: "meta",
            attribute: "name",
            key: "description",
            content: description,
        });
    }
    return tags;
};

const escapeHtml = (value: string): string =>
    value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

const renderHeadTag = (tag: HeadTag): string => {
    if (tag.kind === "title") {
        return `<title>${escapeHtml(tag.text)}</title>`;
    }
    return `<meta ${tag.attribute}="${escapeHtml(tag.key)}" content="${escapeHtml(tag.content)}" ${headTagMarker} />`;
};

export const renderHeadTags = (tags: HeadTag[]): string =>
    tags.map((tag) => renderHeadTag(tag)).join(headTagSeparator);

const createMetaElement = (tag: MetaTag): HTMLMetaElement => {
    const element = document.createElement("meta");
    element.setAttribute(tag.attribute, tag.key);
    element.setAttribute("content", tag.content);
    element.setAttribute(headTagMarker, "");
    return element;
};

export const applyHeadTags = (tags: HeadTag[]): void => {
    for (const element of document.head.querySelectorAll(
        `[${headTagMarker}]`
    )) {
        element.remove();
    }
    for (const tag of tags) {
        if (tag.kind === "title") {
            document.title = tag.text;
        } else {
            document.head.append(createMetaElement(tag));
        }
    }
};
