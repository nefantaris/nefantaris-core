import {
    configFileName,
    type CheckContext,
    type CheckedPage,
} from "./context.js";
import { finding, type Finding } from "./rules.js";

export const descriptionLength = { shortest: 50, longest: 160 };

const characterCount = (value: string): number => [...value.trim()].length;

const pageCount = (count: number): string =>
    count === 1 ? "1 page" : `${String(count)} pages`;

const siteFindings = ({ config, routes }: CheckContext): Finding[] => {
    const findings: Finding[] = [];
    if (config.url === undefined) {
        findings.push(
            finding(
                "meta/no-url",
                { file: configFileName, key: "url" },
                'No "url" is set, so pages get no canonical link and no share link or picture, and the site gets no sitemap. Set it to the address the site is served from, such as "https://example.com".'
            )
        );
    }
    const withoutImage = routes.filter(
        (route) => route.meta.image === undefined
    ).length;
    if (config.image === undefined && withoutImage > 0) {
        findings.push(
            finding(
                "meta/no-og-image",
                { file: configFileName, key: "image" },
                `No share image is set, so shared links to ${pageCount(withoutImage)} show no picture. Set "image" to a default such as "/assets/cover.webp", or give a page its own "image" in frontmatter.`
            )
        );
    }
    return findings;
};

const descriptionFinding = ({ file, route }: CheckedPage): Finding[] => {
    const location = { file, key: "description" };
    const { description } = route.meta;
    const length = description === undefined ? 0 : characterCount(description);
    const range = `${String(descriptionLength.shortest)}–${String(descriptionLength.longest)}`;
    if (length === 0) {
        return [
            finding(
                "meta/description-missing",
                location,
                `This page has no description, so search results and shared links show whatever text a crawler picks. Write ${range} characters saying what the page is about.`
            ),
        ];
    }
    if (length < descriptionLength.shortest) {
        return [
            finding(
                "meta/description-short",
                location,
                `The description is ${String(length)} characters; ${range} gives search results and shared links enough to show.`
            ),
        ];
    }
    if (length > descriptionLength.longest) {
        return [
            finding(
                "meta/description-long",
                location,
                `The description is ${String(length)} characters; search results cut it off after about ${String(descriptionLength.longest)}.`
            ),
        ];
    }
    return [];
};

export const metaFindings = (context: CheckContext): Finding[] => [
    ...siteFindings(context),
    ...context.pages.flatMap(descriptionFinding),
];
