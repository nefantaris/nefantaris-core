import { Link } from "wouter";
import type { SiteMeta } from "../types";

type NotFoundProps = {
    site: SiteMeta;
};

const NotFound = ({ site }: NotFoundProps) => (
    <article>
        <h1>Page not found</h1>
        <p>
            <Link href="/" className="text-link underline">
                Back to {site.name}
            </Link>
        </p>
    </article>
);

export default NotFound;
