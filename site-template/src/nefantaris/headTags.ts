import { absoluteSiteUrl, canonicalUrl } from "./siteUrl";
import type { RouteEntry, SiteMeta } from "./types";

type TitleTag = { kind: "title"; text: string };

type MetaTag = {
    kind: "meta";
    attribute: "name" | "property";
    key: string;
    content: string;
};

type LinkTag = { kind: "link"; rel: string; href: string };

export type HeadTag = TitleTag | MetaTag | LinkTag;

const headTagMarker = "data-nefantaris-head";

const headTagSeparator = "\n        ";

const named = (key: string, content: string): MetaTag => ({
    kind: "meta",
    attribute: "name",
    key,
    content,
});

const property = (key: string, content: string): MetaTag => ({
    kind: "meta",
    attribute: "property",
    key,
    content,
});

const tagsWhenSet = (
    value: string | undefined,
    tagsFor: (value: string) => HeadTag[]
): HeadTag[] => (value === undefined ? [] : tagsFor(value));

const pageTitleFor = (site: SiteMeta, entry: RouteEntry): string =>
    entry.path === "/" ? site.name : entry.meta.title;

const documentTitleFor = (site: SiteMeta, entry: RouteEntry): string =>
    entry.path === "/" ? site.name : `${entry.meta.title} — ${site.name}`;

const imageTags = (imageUrl: string | undefined): HeadTag[] =>
    imageUrl === undefined
        ? [named("twitter:card", "summary")]
        : [
              property("og:image", imageUrl),
              named("twitter:card", "summary_large_image"),
              named("twitter:image", imageUrl),
          ];

const notFoundTags = (site: SiteMeta): HeadTag[] => [
    { kind: "title", text: `Page not found — ${site.name}` },
    named("robots", "noindex"),
];

const routeTags = (site: SiteMeta, entry: RouteEntry): HeadTag[] => {
    const { description, date } = entry.meta;
    const siteUrl = site.url;
    const image = entry.meta.image ?? site.image;
    const pageUrl =
        siteUrl === undefined ? undefined : canonicalUrl(siteUrl, entry.path);
    const imageUrl =
        siteUrl === undefined || image === undefined
            ? undefined
            : absoluteSiteUrl(siteUrl, image);
    return [
        { kind: "title", text: documentTitleFor(site, entry) },
        ...tagsWhenSet(description, (value) => [named("description", value)]),
        ...tagsWhenSet(pageUrl, (value) => [
            { kind: "link", rel: "canonical", href: value },
        ]),
        property("og:title", pageTitleFor(site, entry)),
        property("og:site_name", site.name),
        property("og:type", date === undefined ? "website" : "article"),
        ...tagsWhenSet(pageUrl, (value) => [property("og:url", value)]),
        ...tagsWhenSet(description, (value) => [
            property("og:description", value),
            named("twitter:description", value),
        ]),
        ...imageTags(imageUrl),
    ];
};

export const headTagsFor = (
    site: SiteMeta,
    entry: RouteEntry | undefined
): HeadTag[] =>
    entry === undefined ? notFoundTags(site) : routeTags(site, entry);

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
    if (tag.kind === "link") {
        return `<link rel="${escapeHtml(tag.rel)}" href="${escapeHtml(tag.href)}" ${headTagMarker} />`;
    }
    return `<meta ${tag.attribute}="${escapeHtml(tag.key)}" content="${escapeHtml(tag.content)}" ${headTagMarker} />`;
};

export const renderHeadTags = (tags: HeadTag[]): string =>
    tags.map((tag) => renderHeadTag(tag)).join(headTagSeparator);

const createHeadElement = (tag: MetaTag | LinkTag): HTMLElement => {
    const element = document.createElement(tag.kind);
    if (tag.kind === "link") {
        element.setAttribute("rel", tag.rel);
        element.setAttribute("href", tag.href);
    } else {
        element.setAttribute(tag.attribute, tag.key);
        element.setAttribute("content", tag.content);
    }
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
            document.head.append(createHeadElement(tag));
        }
    }
};
