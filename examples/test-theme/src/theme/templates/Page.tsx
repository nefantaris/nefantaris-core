import type { TemplateProps } from "../types";

const Page = ({ meta, children }: TemplateProps) => (
    <article>
        <h1>{meta.title}</h1>
        {children}
    </article>
);

export default Page;
