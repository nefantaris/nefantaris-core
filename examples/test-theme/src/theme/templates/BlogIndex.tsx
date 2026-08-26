import PostList from "../PostList";
import type { PostListTemplateProps } from "../types";

const BlogIndex = ({ meta, posts, children }: PostListTemplateProps) => (
    <article>
        <h1>{meta.title}</h1>
        {children}
        <PostList posts={posts} />
    </article>
);

export default BlogIndex;
