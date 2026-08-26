import Gallery from "./directives/Gallery";
import Layout from "./Layout";
import BlogIndex from "./templates/BlogIndex";
import Home from "./templates/Home";
import NotFound from "./templates/NotFound";
import Page from "./templates/Page";
import Post from "./templates/Post";
import type { Theme } from "./types";

export const theme: Theme = {
    Layout,
    templates: {
        home: Home,
        page: Page,
        post: Post,
        blogIndex: BlogIndex,
        notFound: NotFound,
    },
    directives: {
        gallery: Gallery,
    },
};
