import type { TemplateProps } from "nefantaris";

const PostTemplate = ({ meta, children }: TemplateProps) => (
    <article>
        <h1>{meta.title}</h1>
        {meta.date !== undefined && (
            <time dateTime={meta.date}>{meta.date}</time>
        )}
        {children}
    </article>
);

export default PostTemplate;
