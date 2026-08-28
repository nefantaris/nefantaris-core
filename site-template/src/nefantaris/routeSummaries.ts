import { routes } from "../generated/content";
import { theme } from "../theme";
import type { RouteEntry, RouteSummary } from "./types";

const fallbackTemplateName = "page";

export const resolvedTemplateName = (template: string): string =>
    Object.hasOwn(theme.templates, template) ? template : fallbackTemplateName;

const summarize = ({ path, template, meta }: RouteEntry): RouteSummary => {
    const summary: RouteSummary = {
        path,
        title: meta.title,
        template: resolvedTemplateName(template),
    };
    if (meta.description !== undefined) {
        summary.description = meta.description;
    }
    if (meta.order !== undefined) {
        summary.order = meta.order;
    }
    return summary;
};

export const routeSummaries: RouteSummary[] = routes.map(summarize);
