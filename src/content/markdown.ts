import type { Definition, List, ListItem, Root, RootContent } from "mdast";
import type {} from "mdast-util-directive";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";
import { NefantarisError } from "../NefantarisError.js";
import { isRecord } from "../narrow.js";
import type { ContentNode } from "./types.js";

export type ParsedMarkdown = {
    frontmatter: Record<string, unknown>;
    body: ContentNode[];
};

type ConversionContext = {
    filePath: string;
    definitions: Map<string, Definition>;
};

const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkDirective);

const extractFrontmatter = (
    tree: Root,
    filePath: string
): Record<string, unknown> => {
    const [first] = tree.children;
    if (!first || first.type !== "yaml") {
        throw new NefantarisError(`${filePath}: missing YAML frontmatter`);
    }
    const parsed: unknown = parseYaml(first.value);
    if (!isRecord(parsed)) {
        throw new NefantarisError(
            `${filePath}: frontmatter must be a YAML mapping`
        );
    }
    return parsed;
};

const collectDefinitions = (tree: Root): Map<string, Definition> => {
    const definitions = new Map<string, Definition>();
    const visit = (nodes: RootContent[]): void => {
        for (const node of nodes) {
            if (node.type === "definition") {
                definitions.set(node.identifier, node);
            }
            if ("children" in node) {
                visit(node.children);
            }
        }
    };
    visit(tree.children);
    return definitions;
};

const element = (
    tag: string,
    props: Record<string, string>,
    children: ContentNode[]
): ContentNode => ({ kind: "element", tag, props, children });

const text = (value: string): ContentNode => ({ kind: "text", value });

const linkProps = (
    url: string,
    title: string | null | undefined
): Record<string, string> => (title ? { href: url, title } : { href: url });

const imageProps = (
    url: string,
    alt: string | null | undefined,
    title: string | null | undefined
): Record<string, string> => {
    const props: Record<string, string> = { src: url, alt: alt ?? "" };
    if (title) {
        props.title = title;
    }
    return props;
};

const listProps = (node: List): Record<string, string> => {
    if (
        node.ordered === true &&
        typeof node.start === "number" &&
        node.start !== 1
    ) {
        return { start: String(node.start) };
    }
    return {};
};

const resolveDefinition = (
    identifier: string,
    context: ConversionContext
): Definition => {
    const definition = context.definitions.get(identifier);
    if (!definition) {
        throw new NefantarisError(
            `${context.filePath}: no definition found for reference "${identifier}"`
        );
    }
    return definition;
};

const convertListItem = (
    node: ListItem,
    context: ConversionContext
): ContentNode[] => {
    const [first] = node.children;
    if (
        node.children.length === 1 &&
        first &&
        first.type === "paragraph" &&
        node.spread !== true
    ) {
        return convertNodes(first.children, context);
    }
    return convertNodes(node.children, context);
};

const convertNode = (
    node: RootContent,
    context: ConversionContext
): ContentNode[] => {
    switch (node.type) {
        case "yaml":
        case "definition":
        case "html":
            return [];
        case "text":
            return [text(node.value)];
        case "paragraph":
            return [element("p", {}, convertNodes(node.children, context))];
        case "heading":
            return [
                element(
                    `h${node.depth}`,
                    {},
                    convertNodes(node.children, context)
                ),
            ];
        case "emphasis":
            return [element("em", {}, convertNodes(node.children, context))];
        case "strong":
            return [
                element("strong", {}, convertNodes(node.children, context)),
            ];
        case "inlineCode":
            return [element("code", {}, [text(node.value)])];
        case "code":
            return [
                element("pre", {}, [
                    element(
                        "code",
                        node.lang ? { className: `language-${node.lang}` } : {},
                        [text(node.value)]
                    ),
                ]),
            ];
        case "blockquote":
            return [
                element("blockquote", {}, convertNodes(node.children, context)),
            ];
        case "thematicBreak":
            return [element("hr", {}, [])];
        case "break":
            return [element("br", {}, [])];
        case "list":
            return [
                element(
                    node.ordered === true ? "ol" : "ul",
                    listProps(node),
                    node.children.flatMap((item) =>
                        element("li", {}, convertListItem(item, context))
                    )
                ),
            ];
        case "link":
            return [
                element(
                    "a",
                    linkProps(node.url, node.title),
                    convertNodes(node.children, context)
                ),
            ];
        case "image":
            return [
                element("img", imageProps(node.url, node.alt, node.title), []),
            ];
        case "linkReference": {
            const definition = resolveDefinition(node.identifier, context);
            return [
                element(
                    "a",
                    linkProps(definition.url, definition.title),
                    convertNodes(node.children, context)
                ),
            ];
        }
        case "imageReference": {
            const definition = resolveDefinition(node.identifier, context);
            return [
                element(
                    "img",
                    imageProps(definition.url, node.alt, definition.title),
                    []
                ),
            ];
        }
        case "containerDirective":
        case "leafDirective":
            return [
                {
                    kind: "directive",
                    name: node.name,
                    children: convertNodes(node.children, context),
                },
            ];
        case "textDirective":
            return [
                { kind: "text", value: `:${node.name}` },
                ...convertNodes(node.children, context),
            ];
        default:
            throw new NefantarisError(
                `${context.filePath}: unsupported markdown node "${node.type}"`
            );
    }
};

const convertNodes = (
    nodes: RootContent[],
    context: ConversionContext
): ContentNode[] => nodes.flatMap((node) => convertNode(node, context));

export const parseMarkdown = (
    source: string,
    filePath: string
): ParsedMarkdown => {
    const tree = processor.parse(source);
    const frontmatter = extractFrontmatter(tree, filePath);
    const definitions = collectDefinitions(tree);
    const body = convertNodes(tree.children, { filePath, definitions });
    return { frontmatter, body };
};
