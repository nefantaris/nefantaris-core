import type { CheckContext, CheckedPage } from "./context.js";
import { finding, type Finding } from "./rules.js";
import { stringProp, textContent, type ContentElement } from "./walk.js";

const titleHeadingLevel = 1;

const headingPattern = /^h([1-6])$/;

const footnoteLinkProps = ["data-footnote-ref", "data-footnote-backref"];

const vagueLinkTexts = new Set([
    "click here",
    "click this",
    "go",
    "here",
    "information",
    "learn more",
    "link",
    "more",
    "more info",
    "more information",
    "read more",
    "right here",
    "see more",
    "start",
    "this",
    "this link",
    "this page",
]);

const normalizedLinkText = (element: ContentElement): string =>
    textContent(element.children)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

const emptyAltFindings = ({ file, elements }: CheckedPage): Finding[] =>
    elements
        .filter(
            (element) =>
                element.tag === "img" &&
                (stringProp(element.props, "alt") ?? "").trim() === ""
        )
        .map((element) =>
            finding(
                "a11y/empty-alt",
                { file },
                `Image "${stringProp(element.props, "src") ?? ""}" has no alt text, so screen readers skip it. Describe it inside the brackets: ![what it shows](…).`
            )
        );

const headingLevel = (element: ContentElement): number | undefined => {
    const match = headingPattern.exec(element.tag);
    return match === null ? undefined : Number(match[1]);
};

const previousHeadingLabel = (level: number, isTitle: boolean): string =>
    isTitle
        ? `the page title, which is level ${String(level)}`
        : `level ${String(level)}`;

const headingSkipFindings = ({ file, elements }: CheckedPage): Finding[] => {
    const findings: Finding[] = [];
    let previousLevel = titleHeadingLevel;
    let isAfterTitle = true;
    for (const element of elements) {
        const level = headingLevel(element);
        if (level === undefined) {
            continue;
        }
        if (level > previousLevel + 1) {
            const expected = previousLevel + 1;
            findings.push(
                finding(
                    "a11y/heading-skip",
                    { file },
                    `Heading "${textContent(element.children).trim()}" is level ${String(level)} right after ${previousHeadingLabel(previousLevel, isAfterTitle)}; use level ${String(expected)} (${"#".repeat(expected)}) so the outline has no gap.`
                )
            );
        }
        previousLevel = level;
        isAfterTitle = false;
    }
    return findings;
};

const isFootnoteLink = (element: ContentElement): boolean =>
    footnoteLinkProps.some((name) => element.props[name] !== undefined);

const vagueLinkFindings = ({ file, elements }: CheckedPage): Finding[] =>
    elements
        .filter((element) => element.tag === "a" && !isFootnoteLink(element))
        .flatMap((element) => {
            const href = stringProp(element.props, "href") ?? "";
            const text = normalizedLinkText(element);
            if (text === "") {
                return [
                    finding(
                        "a11y/vague-link-text",
                        { file },
                        `The link to "${href}" has no text, so screen readers can only announce its address.`
                    ),
                ];
            }
            if (vagueLinkTexts.has(text)) {
                return [
                    finding(
                        "a11y/vague-link-text",
                        { file },
                        `The link text "${textContent(element.children).trim()}" (to "${href}") says nothing about where it goes. Use words that name the destination.`
                    ),
                ];
            }
            return [];
        });

export const a11yFindings = (context: CheckContext): Finding[] =>
    context.pages.flatMap((page) => [
        ...headingSkipFindings(page),
        ...emptyAltFindings(page),
        ...vagueLinkFindings(page),
    ]);
