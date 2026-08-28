import { createElement } from "react";
import type { LayoutProps, TemplateProps, Theme } from "../nefantaris/types";

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
    notFound: NotFound,
    templates: {
        page: ContentPage,
    },
    directives: {},
};
