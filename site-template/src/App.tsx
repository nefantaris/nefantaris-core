import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { posts, routes, site } from "./generated/content";
import { applyHead, headForPath, normalizePath } from "./nefantaris/head";
import { renderContent } from "./nefantaris/renderContent";
import type { RouteEntry } from "./nefantaris/types";
import { theme } from "./theme";

type RoutedTemplateProps = {
    entry: RouteEntry;
};

const RoutedTemplate = ({ entry }: RoutedTemplateProps) => {
    const body = renderContent(entry.body, theme.directives);

    if (entry.template === "home") {
        return (
            <theme.templates.home site={site} meta={entry.meta} posts={posts}>
                {body}
            </theme.templates.home>
        );
    }
    if (entry.template === "blogIndex") {
        return (
            <theme.templates.blogIndex
                site={site}
                meta={entry.meta}
                posts={posts}
            >
                {body}
            </theme.templates.blogIndex>
        );
    }
    if (entry.template === "post") {
        return (
            <theme.templates.post site={site} meta={entry.meta}>
                {body}
            </theme.templates.post>
        );
    }
    return (
        <theme.templates.page site={site} meta={entry.meta}>
            {body}
        </theme.templates.page>
    );
};

const App = () => {
    const [location] = useLocation();
    const currentPath = normalizePath(location);

    useEffect(() => {
        applyHead(headForPath(currentPath));
    }, [currentPath]);

    return (
        <theme.Layout site={site}>
            <Switch location={currentPath}>
                {routes.map((entry) => (
                    <Route key={entry.path} path={entry.path}>
                        <RoutedTemplate entry={entry} />
                    </Route>
                ))}
                <Route>
                    <theme.templates.notFound site={site} />
                </Route>
            </Switch>
        </theme.Layout>
    );
};

export default App;
