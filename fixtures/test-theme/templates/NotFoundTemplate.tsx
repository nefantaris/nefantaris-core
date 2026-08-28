import type { NotFoundProps } from "nefantaris";
import { Link } from "wouter";

const NotFoundTemplate = ({ site }: NotFoundProps) => (
    <article>
        <h1>Page not found</h1>
        <p>
            <Link href="/" className="text-link underline">
                Back to {site.name}
            </Link>
        </p>
    </article>
);

export default NotFoundTemplate;
