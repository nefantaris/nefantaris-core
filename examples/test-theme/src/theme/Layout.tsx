import { Link } from "wouter";
import type { LayoutProps } from "./types";

const Layout = ({ site, children }: LayoutProps) => (
    <div className="bg-paper text-ink mx-auto min-h-screen max-w-3xl p-4">
        <a href="#main-content" className="sr-only focus:not-sr-only">
            Skip to main content
        </a>
        <header>
            <nav aria-label="Main" className="flex gap-3">
                <Link href="/" className="text-link underline">
                    {site.name}
                </Link>
                <Link href="/about" className="text-link underline">
                    About
                </Link>
                <Link href="/gallery" className="text-link underline">
                    Gallery
                </Link>
                <Link href="/blog" className="text-link underline">
                    Blog
                </Link>
            </nav>
        </header>
        <main id="main-content">{children}</main>
    </div>
);

export default Layout;
