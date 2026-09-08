import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import App from "./App";
import { routes } from "./generated/content";
import { headForPath } from "./nefantaris/head";

export type RenderResult = {
    appHtml: string;
    title: string;
    description?: string;
};

export const render = (path: string): RenderResult => {
    const appHtml = renderToString(
        <StrictMode>
            <Router ssrPath={path}>
                <App />
            </Router>
        </StrictMode>
    );
    const head = headForPath(path);
    return { appHtml, title: head.title, description: head.description };
};

export const routePaths: string[] = routes.map((entry) => entry.path);
