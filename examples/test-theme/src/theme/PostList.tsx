import { Link } from "wouter";
import type { PostSummary } from "./types";

type PostListProps = {
    posts: PostSummary[];
};

const PostList = ({ posts }: PostListProps) => (
    <ul>
        {posts.map((post) => (
            <li key={post.route}>
                <Link href={post.route} className="text-link underline">
                    {post.title}
                </Link>{" "}
                <time dateTime={post.date}>{post.date}</time>
            </li>
        ))}
    </ul>
);

export default PostList;
