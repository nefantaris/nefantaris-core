import type { ComponentType, PropsWithChildren } from "react";

export type SiteMeta = { name: string };

export type NavItem = {
    label: string;
    href: string;
    children?: NavItem[];
};

export type PageMeta = {
    title: string;
    description?: string;
    date?: string;
    slug?: string;
    draft?: boolean;
    template?: string;
    order?: number;
};

export type PostSummary = {
    route: string;
    title: string;
    description?: string;
    date: string;
};

export type ElementProps = Record<string, string | boolean>;

export type ContentNode =
    | { kind: "text"; value: string }
    | {
          kind: "element";
          tag: string;
          props: ElementProps;
          children: ContentNode[];
      }
    | { kind: "directive"; name: string; children: ContentNode[] };

export type RouteEntry = {
    path: string;
    template: string;
    meta: PageMeta;
    body: ContentNode[];
};

export type RouteSummary = {
    path: string;
    title: string;
    description?: string;
    template: string;
    order?: number;
};

export type Mode = "light" | "dark";

export type ModeDefault = Mode | "system";

export type ModeSettings = { available: Mode[]; default: ModeDefault };

export type ModeState = {
    available: Mode[];
    current: Mode;
    set: (mode: Mode) => void;
};

export type LayoutProps = PropsWithChildren<{
    site: SiteMeta;
    nav: NavItem[];
    routes: RouteSummary[];
    currentPath: string;
    template: string | undefined;
    modes: ModeState;
}>;

export type TemplateProps = PropsWithChildren<{
    site: SiteMeta;
    meta: PageMeta;
    posts: PostSummary[];
    routes: RouteSummary[];
}>;

export type NotFoundProps = { site: SiteMeta };

export type DirectiveComponents = Record<
    string,
    ComponentType<PropsWithChildren>
>;

export type Theme = {
    Layout: ComponentType<LayoutProps>;
    templates: Record<string, ComponentType<TemplateProps>>;
    notFound: ComponentType<NotFoundProps>;
    directives: DirectiveComponents;
};
