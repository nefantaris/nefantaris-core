import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import App from "./App";
import { routes } from "./generated/content";
import { renderHead } from "./nefantaris/head";

export type RenderResult = {
    appHtml: string;
    headHtml: string;
};

export const render = (path: string): RenderResult => {
    const appHtml = renderToString(
        <StrictMode>
            <Router ssrPath={path}>
                <App />
            </Router>
        </StrictMode>
    );
    return { appHtml, headHtml: renderHead(path) };
};

export const routePaths: string[] = routes.map((entry) => entry.path);
