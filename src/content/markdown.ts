import type {
    AlignType,
    Definition,
    FootnoteDefinition,
    List,
    ListItem,
    Root,
    RootContent,
    Table,
    TableRow,
} from "mdast";
import type {} from "mdast-util-directive";
import remarkDirective from "remark-directive";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";
import { NefantarisError } from "../NefantarisError.js";
import { isRecord } from "../narrow.js";
import type { ContentNode, ElementProps } from "./types.js";

export type ParsedMarkdown = {
    frontmatter: Record<string, unknown>;
    body: ContentNode[];
};

type FootnoteUsage = {
    definition: FootnoteDefinition;
    number: number;
    referenceCount: number;
};

type FootnoteBody = {
    usage: FootnoteUsage;
    blocks: ContentNode[];
};

type ReferenceTargets = {
    definitions: Map<string, Definition>;
    footnoteDefinitions: Map<string, FootnoteDefinition>;
};

type ConversionContext = ReferenceTargets & {
    filePath: string;
    footnoteUsage: FootnoteUsage[];
};

const footnotesLabelId = "footnotes-label";
const footnotesHeading = "Footnotes";
const backReferenceSymbol = "↩";
const taskCheckboxLabel = "Task";

const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
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

const collectReferenceTargets = (tree: Root): ReferenceTargets => {
    const targets: ReferenceTargets = {
        definitions: new Map(),
        footnoteDefinitions: new Map(),
    };
    const visit = (nodes: RootContent[]): void => {
        for (const node of nodes) {
            if (node.type === "definition") {
                targets.definitions.set(node.identifier, node);
            }
            if (node.type === "footnoteDefinition") {
                targets.footnoteDefinitions.set(node.identifier, node);
            }
            if ("children" in node) {
                visit(node.children);
            }
        }
    };
    visit(tree.children);
    return targets;
};

const element = (
    tag: string,
    props: ElementProps,
    children: ContentNode[]
): ContentNode => ({ kind: "element", tag, props, children });

const text = (value: string): ContentNode => ({ kind: "text", value });

const linkProps = (
    url: string,
    title: string | null | undefined
): ElementProps => (title ? { href: url, title } : { href: url });

const imageProps = (
    url: string,
    alt: string | null | undefined,
    title: string | null | undefined
): ElementProps => {
    const props: ElementProps = { src: url, alt: alt ?? "" };
    if (title) {
        props.title = title;
    }
    return props;
};

const isTaskItem = (item: ListItem): boolean =>
    typeof item.checked === "boolean";

const listProps = (node: List): ElementProps => {
    const props: ElementProps = {};
    if (
        node.ordered === true &&
        typeof node.start === "number" &&
        node.start !== 1
    ) {
        props.start = String(node.start);
    }
    if (node.children.some(isTaskItem)) {
        props["data-task-list"] = "";
    }
    return props;
};

const alignProps = (
    align: AlignType[] | null | undefined,
    index: number
): ElementProps => {
    const alignment = align?.[index];
    return alignment ? { "data-align": alignment } : {};
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

const registerFootnoteReference = (
    identifier: string,
    context: ConversionContext
): FootnoteUsage => {
    const existing = context.footnoteUsage.find(
        (usage) => usage.definition.identifier === identifier
    );
    if (existing) {
        existing.referenceCount += 1;
        return existing;
    }
    const definition = context.footnoteDefinitions.get(identifier);
    if (!definition) {
        throw new NefantarisError(
            `${context.filePath}: no footnote definition found for reference "${identifier}"`
        );
    }
    const usage: FootnoteUsage = {
        definition,
        number: context.footnoteUsage.length + 1,
        referenceCount: 1,
    };
    context.footnoteUsage.push(usage);
    return usage;
};

const occurrenceSuffix = (occurrence: number): string =>
    occurrence === 1 ? "" : `-${String(occurrence)}`;

const footnoteId = (number: number): string => `footnote-${String(number)}`;

const footnoteReferenceId = (number: number, occurrence: number): string =>
    `footnote-ref-${String(number)}${occurrenceSuffix(occurrence)}`;

const footnoteReferenceNode = (
    usage: FootnoteUsage,
    occurrence: number
): ContentNode =>
    element("sup", {}, [
        element(
            "a",
            {
                href: `#${footnoteId(usage.number)}`,
                id: footnoteReferenceId(usage.number, occurrence),
                "data-footnote-ref": "",
                "aria-describedby": footnotesLabelId,
            },
            [text(String(usage.number))]
        ),
    ]);

const backReferenceNode = (
    usage: FootnoteUsage,
    occurrence: number
): ContentNode =>
    element(
        "a",
        {
            href: `#${footnoteReferenceId(usage.number, occurrence)}`,
            "data-footnote-backref": "",
            "aria-label": `Back to reference ${String(usage.number)}${occurrenceSuffix(occurrence)}`,
        },
        [
            text(
                `${backReferenceSymbol}${occurrence === 1 ? "" : String(occurrence)}`
            ),
        ]
    );

const spaced = (nodes: ContentNode[]): ContentNode[] =>
    nodes.flatMap((node, index) => (index === 0 ? [node] : [text(" "), node]));

const withBackReferences = ({ usage, blocks }: FootnoteBody): ContentNode[] => {
    const backReferences = spaced(
        Array.from({ length: usage.referenceCount }, (_, index) =>
            backReferenceNode(usage, index + 1)
        )
    );
    const last = blocks.at(-1);
    if (last === undefined || last.kind !== "element" || last.tag !== "p") {
        return [...blocks, element("p", {}, backReferences)];
    }
    return [
        ...blocks.slice(0, -1),
        element("p", last.props, [
            ...last.children,
            text(" "),
            ...backReferences,
        ]),
    ];
};

const footnotesSection = (context: ConversionContext): ContentNode[] => {
    const bodies: FootnoteBody[] = [];
    for (const usage of context.footnoteUsage) {
        bodies.push({
            usage,
            blocks: convertNodes(usage.definition.children, context),
        });
    }
    if (bodies.length === 0) {
        return [];
    }
    return [
        element("section", { "data-footnotes": "" }, [
            element("h2", { id: footnotesLabelId }, [text(footnotesHeading)]),
            element(
                "ol",
                {},
                bodies.map((body) =>
                    element(
                        "li",
                        { id: footnoteId(body.usage.number) },
                        withBackReferences(body)
                    )
                )
            ),
        ]),
    ];
};

const convertListItem = (
    node: ListItem,
    context: ConversionContext
): ContentNode => {
    const [first] = node.children;
    const blocks =
        node.children.length === 1 &&
        first &&
        first.type === "paragraph" &&
        node.spread !== true
            ? convertNodes(first.children, context)
            : convertNodes(node.children, context);
    if (typeof node.checked !== "boolean") {
        return element("li", {}, blocks);
    }
    return element("li", { "data-task-item": "" }, [
        element(
            "input",
            {
                type: "checkbox",
                checked: node.checked,
                disabled: true,
                "aria-label": taskCheckboxLabel,
            },
            []
        ),
        text(" "),
        ...blocks,
    ]);
};

const convertTableRow = (
    row: TableRow,
    isHeader: boolean,
    align: AlignType[] | null | undefined,
    context: ConversionContext
): ContentNode =>
    element(
        "tr",
        {},
        row.children.map((cell, index) =>
            element(
                isHeader ? "th" : "td",
                isHeader
                    ? { scope: "col", ...alignProps(align, index) }
                    : alignProps(align, index),
                convertNodes(cell.children, context)
            )
        )
    );

const convertTable = (
    node: Table,
    context: ConversionContext
): ContentNode[] => {
    const [headerRow, ...bodyRows] = node.children;
    const sections: ContentNode[] = [];
    if (headerRow) {
        sections.push(
            element("thead", {}, [
                convertTableRow(headerRow, true, node.align, context),
            ])
        );
    }
    if (bodyRows.length > 0) {
        sections.push(
            element(
                "tbody",
                {},
                bodyRows.map((row) =>
                    convertTableRow(row, false, node.align, context)
                )
            )
        );
    }
    return [element("table", {}, sections)];
};

const convertNode = (
    node: RootContent,
    context: ConversionContext
): ContentNode[] => {
    switch (node.type) {
        case "yaml":
        case "definition":
        case "footnoteDefinition":
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
        case "delete":
            return [element("del", {}, convertNodes(node.children, context))];
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
                    node.children.map((item) => convertListItem(item, context))
                ),
            ];
        case "table":
            return convertTable(node, context);
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
        case "footnoteReference": {
            const usage = registerFootnoteReference(node.identifier, context);
            return [footnoteReferenceNode(usage, usage.referenceCount)];
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
    const context: ConversionContext = {
        filePath,
        footnoteUsage: [],
        ...collectReferenceTargets(tree),
    };
    const body = convertNodes(tree.children, context);
    return { frontmatter, body: [...body, ...footnotesSection(context)] };
};
