import type { LayoutProps, ModeState, NavItem } from "nefantaris";
import { Link } from "wouter";

type NavLinkProps = {
    item: NavItem;
    currentPath: string;
};

const NavLink = ({ item, currentPath }: NavLinkProps) => (
    <Link
        href={item.href}
        className="text-link underline"
        aria-current={item.href === currentPath ? "page" : undefined}
    >
        {item.label}
    </Link>
);

type ModeSwitchProps = {
    modes: ModeState;
};

const ModeSwitch = ({ modes }: ModeSwitchProps) => {
    const next = modes.available.find((mode) => mode !== modes.current);

    return next === undefined ? null : (
        <button type="button" data-mode-switch onClick={() => modes.set(next)}>
            {`Switch to ${next} mode`}
        </button>
    );
};

const Layout = ({
    site,
    nav,
    routes,
    currentPath,
    template,
    modes,
    children,
}: LayoutProps) => (
    <div
        data-template={template}
        className="bg-paper text-ink mx-auto min-h-screen max-w-3xl p-4"
    >
        <a href="#main-content" className="sr-only focus:not-sr-only">
            Skip to main content
        </a>
        <header>
            <p>{site.name}</p>
            <nav aria-label="Main" className="flex gap-3">
                {nav.map((item) => (
                    <NavLink
                        key={item.href}
                        item={item}
                        currentPath={currentPath}
                    />
                ))}
            </nav>
            {modes.available.length > 1 && <ModeSwitch modes={modes} />}
        </header>
        <main id="main-content">{children}</main>
        <footer>
            <nav aria-label="All routes">
                <ul>
                    {routes.map((route) => (
                        <li
                            key={route.path}
                            data-route-template={route.template}
                        >
                            <Link
                                href={route.path}
                                className="text-link underline"
                            >
                                {route.path}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>
        </footer>
    </div>
);

export default Layout;
