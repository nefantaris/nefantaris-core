import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { nav, posts, routes, site } from "./generated/content";
import {
    applyHead,
    headForPath,
    normalizePath,
    routeForPath,
} from "./nefantaris/head";
import { renderContent } from "./nefantaris/renderContent";
import {
    resolvedTemplateName,
    routeSummaries,
} from "./nefantaris/routeSummaries";
import type { RouteEntry } from "./nefantaris/types";
import { theme } from "./theme";

type RoutedTemplateProps = {
    entry: RouteEntry;
};

const RoutedTemplate = ({ entry }: RoutedTemplateProps) => {
    const Template = theme.templates[resolvedTemplateName(entry.template)];

    return (
        <Template
            site={site}
            meta={entry.meta}
            posts={posts}
            routes={routeSummaries}
        >
            {renderContent(entry.body, theme.directives)}
        </Template>
    );
};

const App = () => {
    const [location] = useLocation();
    const currentPath = normalizePath(location);
    const currentEntry = routeForPath(currentPath);
    const currentTemplate =
        currentEntry === undefined
            ? undefined
            : resolvedTemplateName(currentEntry.template);

    useEffect(() => {
        applyHead(headForPath(currentPath));
    }, [currentPath]);

    return (
        <theme.Layout
            site={site}
            nav={nav}
            routes={routeSummaries}
            currentPath={currentPath}
            template={currentTemplate}
        >
            <Switch location={currentPath}>
                {routes.map((entry) => (
                    <Route key={entry.path} path={entry.path}>
                        <RoutedTemplate entry={entry} />
                    </Route>
                ))}
                <Route>
                    <theme.notFound site={site} />
                </Route>
            </Switch>
        </theme.Layout>
    );
};

export default App;
