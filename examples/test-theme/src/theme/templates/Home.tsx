import PostList from "../PostList";
import type { PostListTemplateProps } from "../types";

const Home = ({ meta, posts, children }: PostListTemplateProps) => (
    <article>
        <h1>{meta.title}</h1>
        {children}
        <h2>Latest posts</h2>
        <PostList posts={posts} />
    </article>
);

export default Home;
