import { fileURLToPath } from "node:url";

export const fixtureSiteDir = fileURLToPath(
    new URL("../fixtures/demo-site", import.meta.url)
);

export const fixtureDistDir = fileURLToPath(
    new URL("../fixtures/demo-site/dist", import.meta.url)
);

export const previewPort = Number(process.env.PORT ?? "4173");

export const previewBaseUrl = `http://localhost:${String(previewPort)}`;

export const siteName = "Nefantaris Demo";

export type PrerenderedRoute = {
    path: string;
    file: string;
    title: string;
    description: string | undefined;
    heading: string;
    template: string;
};

export const prerenderedRoutes: PrerenderedRoute[] = [
    {
        path: "/",
        file: "index.html",
        title: siteName,
        description: "A demo site built from a markdown repo by Nefantaris.",
        heading: "Welcome",
        template: "home",
    },
    {
        path: "/about",
        file: "about/index.html",
        title: `About — ${siteName}`,
        description: "What this demo site is and how it gets built.",
        heading: "About",
        template: "page",
    },
    {
        path: "/markdown",
        file: "markdown/index.html",
        title: `Markdown reference — ${siteName}`,
        description:
            "Every markdown construct the Nefantaris content pipeline emits.",
        heading: "Markdown reference",
        template: "page",
    },
    {
        path: "/gallery",
        file: "gallery/index.html",
        title: `Gallery — ${siteName}`,
        description: "A page that exercises the gallery directive.",
        heading: "Gallery",
        template: "page",
    },
    {
        path: "/custom-route",
        file: "custom-route/index.html",
        title: `A page with a custom slug — ${siteName}`,
        description:
            "The route comes from frontmatter, not from the file path.",
        heading: "A page with a custom slug",
        template: "page",
    },
    {
        path: "/guides/deployment",
        file: "guides/deployment/index.html",
        title: `Deployment — ${siteName}`,
        description: "A nested page, proving the route mirrors the file path.",
        heading: "Deployment",
        template: "page",
    },
    {
        path: "/guides/introduction",
        file: "guides/introduction/index.html",
        title: `Introduction — ${siteName}`,
        description:
            "The first page of an authored sequence, ordered ahead of its alphabetical neighbours.",
        heading: "Introduction",
        template: "page",
    },
    {
        path: "/guides/installation",
        file: "guides/installation/index.html",
        title: `Installation — ${siteName}`,
        description:
            "The second page of an authored sequence, even though it sorts first by path.",
        heading: "Installation",
        template: "page",
    },
    {
        path: "/blog",
        file: "blog/index.html",
        title: `Blog — ${siteName}`,
        description: undefined,
        heading: "Blog",
        template: "blogIndex",
    },
    {
        path: "/blog/building-in-public",
        file: "blog/building-in-public/index.html",
        title: `Building in public — ${siteName}`,
        description: "Notes from building the Nefantaris proof of concept.",
        heading: "Building in public",
        template: "post",
    },
    {
        path: "/blog/why-markdown",
        file: "blog/why-markdown/index.html",
        title: `Why markdown — ${siteName}`,
        description: "Plain text with a future.",
        heading: "Why markdown",
        template: "post",
    },
    {
        path: "/blog/hello-world",
        file: "blog/hello-world/index.html",
        title: `Hello, world — ${siteName}`,
        description: "The first post on the Nefantaris demo blog.",
        heading: "Hello, world",
        template: "post",
    },
];

export const orderedRoutePaths = [
    "/",
    "/markdown",
    "/about",
    "/guides/introduction",
    "/guides/installation",
];

export const unorderedRoutePaths = prerenderedRoutes
    .map((route) => route.path)
    .filter((path) => !orderedRoutePaths.includes(path))
    .sort((first, second) => first.localeCompare(second));

export const routePathsInRouteOrder = [
    ...orderedRoutePaths,
    ...unorderedRoutePaths,
];

export const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Markdown", href: "/markdown" },
    { label: "Gallery", href: "/gallery" },
    { label: "Blog", href: "/blog" },
];

export const postsNewestFirst = [
    "Building in public",
    "Why markdown",
    "Hello, world",
];

export const draftRoutes = ["/hidden-draft", "/blog/secret-draft"];

export const notFoundTitle = `Page not found — ${siteName}`;
