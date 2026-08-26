import type { ComponentType, PropsWithChildren } from "react";
import { createElement } from "react";

type SiteMeta = { name: string };

type PageMeta = {
    title: string;
    description?: string;
    date?: string;
    slug?: string;
    draft?: boolean;
    template?: string;
};

type PostSummary = {
    route: string;
    title: string;
    description?: string;
    date: string;
};

type LayoutProps = PropsWithChildren<{ site: SiteMeta }>;

type TemplateProps = PropsWithChildren<{ site: SiteMeta; meta: PageMeta }>;

type PostListTemplateProps = TemplateProps & { posts: PostSummary[] };

type Theme = {
    Layout: ComponentType<LayoutProps>;
    templates: {
        home: ComponentType<PostListTemplateProps>;
        page: ComponentType<TemplateProps>;
        post: ComponentType<TemplateProps>;
        blogIndex: ComponentType<PostListTemplateProps>;
        notFound: ComponentType<{ site: SiteMeta }>;
    };
    directives: Record<string, ComponentType<PropsWithChildren>>;
};

const Layout = ({ children }: LayoutProps) =>
    createElement("main", null, children);

const ContentPage = ({ meta, children }: TemplateProps) =>
    createElement(
        "article",
        null,
        createElement("h1", null, meta.title),
        children
    );

const NotFound = () => createElement("h1", null, "Page not found");

export const theme: Theme = {
    Layout,
    templates: {
        home: ContentPage,
        page: ContentPage,
        post: ContentPage,
        blogIndex: ContentPage,
        notFound: NotFound,
    },
    directives: {},
};
