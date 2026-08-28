import type { TemplateProps } from "nefantaris";
import PostList from "../components/PostList";

const HomeTemplate = ({ meta, posts, children }: TemplateProps) => (
    <article>
        <h1>{meta.title}</h1>
        {children}
        <h2>Latest posts</h2>
        <PostList posts={posts} />
    </article>
);

export default HomeTemplate;
