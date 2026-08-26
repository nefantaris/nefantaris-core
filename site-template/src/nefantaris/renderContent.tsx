import type { ReactNode } from "react";
import { createElement, Fragment } from "react";
import { Link } from "wouter";
import type { ContentNode, DirectiveComponents } from "./types";

const voidTags = new Set(["img", "hr", "br"]);

const isRouteHref = (href: string): boolean =>
    href.startsWith("/") && !href.startsWith("/assets/");

const renderNode = (
    node: ContentNode,
    key: number,
    directives: DirectiveComponents
): ReactNode => {
    if (node.kind === "text") {
        return <Fragment key={key}>{node.value}</Fragment>;
    }
    if (node.kind === "directive") {
        const Directive = directives[node.name];
        if (!Directive) {
            throw new Error(
                `Unknown directive ":::${node.name}". The theme does not provide a directive named "${node.name}".`
            );
        }
        return (
            <Directive key={key}>
                {renderContent(node.children, directives)}
            </Directive>
        );
    }
    if (node.tag === "a") {
        const { href, ...anchorProps } = node.props;
        if (typeof href === "string" && isRouteHref(href)) {
            return (
                <Link key={key} href={href} {...anchorProps}>
                    {renderContent(node.children, directives)}
                </Link>
            );
        }
    }
    if (voidTags.has(node.tag)) {
        return createElement(node.tag, { key, ...node.props });
    }
    return createElement(
        node.tag,
        { key, ...node.props },
        renderContent(node.children, directives)
    );
};

export const renderContent = (
    nodes: ContentNode[],
    directives: DirectiveComponents
): ReactNode => (
    <>{nodes.map((node, index) => renderNode(node, index, directives))}</>
);
