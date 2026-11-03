import type { ContentNode, ElementProps } from "../content/types.js";

export type ContentElement = Extract<ContentNode, { kind: "element" }>;

export const contentElements = (nodes: ContentNode[]): ContentElement[] =>
    nodes.flatMap((node) => {
        if (node.kind === "text") {
            return [];
        }
        if (node.kind === "directive") {
            return contentElements(node.children);
        }
        return [node, ...contentElements(node.children)];
    });

export const stringProp = (
    props: ElementProps,
    name: string
): string | undefined => {
    const value = props[name];
    return typeof value === "string" ? value : undefined;
};

export const textContent = (nodes: ContentNode[]): string =>
    nodes
        .map((node) => {
            if (node.kind === "text") {
                return node.value;
            }
            if (node.kind === "element" && node.tag === "img") {
                return stringProp(node.props, "alt") ?? "";
            }
            return textContent(node.children);
        })
        .join("");
