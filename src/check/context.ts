import type { NavItem, SiteConfig } from "../config.js";
import type { SiteContent } from "../content/index.js";
import type { RouteEntry } from "../content/types.js";
import type { ThemeManifest } from "../themes/manifest.js";
import type { FindingLocation } from "./rules.js";
import {
    assetReferencesOutsideContent,
    loadSiteFiles,
    routeDirectory,
    sitePath,
    type SiteFiles,
} from "./siteFiles.js";
import { contentElements, stringProp, type ContentElement } from "./walk.js";

export const configFileName = "nefantaris.json";

export type LoadedSite = {
    siteDir: string;
    config: SiteConfig;
    manifest: ThemeManifest;
    content: SiteContent;
};

export type CheckedPage = {
    file: string;
    route: RouteEntry;
    elements: ContentElement[];
};

export type ReferenceKind = "link" | "image";

export type Reference = {
    kind: ReferenceKind;
    value: string;
    basePath: string;
    location: FindingLocation;
};

export type CheckContext = {
    siteDir: string;
    config: SiteConfig;
    routes: RouteEntry[];
    pages: CheckedPage[];
    routePaths: Set<string>;
    references: Reference[];
    files: SiteFiles;
    assetReferencesOutsideContent: string[];
};

const rootPath = "/";

const checkedPages = (siteDir: string, routes: RouteEntry[]): CheckedPage[] =>
    routes.flatMap((route) =>
        route.sourceFile === undefined
            ? []
            : [
                  {
                      file: sitePath(siteDir, route.sourceFile),
                      route,
                      elements: contentElements(route.body),
                  },
              ]
    );

const navReferences = (items: NavItem[], keyPrefix: string): Reference[] =>
    items.flatMap((item, index): Reference[] => {
        const key = `${keyPrefix}[${String(index)}]`;
        return [
            {
                kind: "link",
                value: item.href,
                basePath: rootPath,
                location: { file: configFileName, key: `${key}.href` },
            },
            ...navReferences(item.children ?? [], `${key}.children`),
        ];
    });

const referenceAttributes = new Map<
    string,
    { kind: ReferenceKind; attribute: string }
>([
    ["a", { kind: "link", attribute: "href" }],
    ["img", { kind: "image", attribute: "src" }],
]);

const elementReferences = (
    element: ContentElement,
    page: CheckedPage
): Reference[] => {
    const reference = referenceAttributes.get(element.tag);
    const value =
        reference === undefined
            ? undefined
            : stringProp(element.props, reference.attribute);
    if (reference === undefined || value === undefined) {
        return [];
    }
    return [
        {
            kind: reference.kind,
            value,
            basePath: routeDirectory(page.route.path),
            location: { file: page.file },
        },
    ];
};

const pageReferences = (page: CheckedPage): Reference[] => {
    const { image } = page.route.meta;
    const frontmatterImage: Reference[] =
        image === undefined
            ? []
            : [
                  {
                      kind: "image",
                      value: image,
                      basePath: rootPath,
                      location: { file: page.file, key: "image" },
                  },
              ];
    return [
        ...frontmatterImage,
        ...page.elements.flatMap((element) => elementReferences(element, page)),
    ];
};

const siteImageReferences = (config: SiteConfig): Reference[] =>
    config.image === undefined
        ? []
        : [
              {
                  kind: "image",
                  value: config.image,
                  basePath: rootPath,
                  location: { file: configFileName, key: "image" },
              },
          ];

export const checkContext = async ({
    siteDir,
    config,
    manifest,
    content,
}: LoadedSite): Promise<CheckContext> => {
    const pages = checkedPages(siteDir, content.routes);
    return {
        siteDir,
        config,
        routes: content.routes,
        pages,
        routePaths: new Set(content.routes.map((route) => route.path)),
        references: [
            ...siteImageReferences(config),
            ...navReferences(config.nav, "nav"),
            ...pages.flatMap(pageReferences),
        ],
        files: await loadSiteFiles(siteDir, config.url),
        assetReferencesOutsideContent: await assetReferencesOutsideContent(
            siteDir,
            manifest.themeDir
        ),
    };
};
