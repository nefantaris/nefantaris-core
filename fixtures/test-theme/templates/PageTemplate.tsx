import type { TemplateProps } from "nefantaris";

const PageTemplate = ({ meta, children }: TemplateProps) => (
    <article>
        <h1>{meta.title}</h1>
        {children}
    </article>
);

export default PageTemplate;
