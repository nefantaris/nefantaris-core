import type { TemplateProps } from "nefantaris";
import PostList from "../components/PostList";

const BlogIndexTemplate = ({ meta, posts, children }: TemplateProps) => (
    <article>
        <h1>{meta.title}</h1>
        {children}
        <PostList posts={posts} />
    </article>
);

export default BlogIndexTemplate;
