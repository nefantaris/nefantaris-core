import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
    draftRoutes,
    fixtureDistDir,
    navLinks,
    notFoundTitle,
    orderedRoutePaths,
    postsNewestFirst,
    prerenderedRoutes,
    routePathsInRouteOrder,
    siteName,
    unorderedRoutePaths,
} from "./fixtureSite";

const escapeForAttribute = (value: string): string =>
    value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

for (const route of prerenderedRoutes) {
    test(`${route.path} is prerendered to a real HTML file`, async ({
        request,
    }) => {
        expect(existsSync(join(fixtureDistDir, route.file))).toBe(true);

        const response = await request.get(route.path);
        expect(response.status()).toBe(200);

        const html = await response.text();
        expect(html).toContain(`<title>${route.title}</title>`);
        expect(html).toContain('<div id="root">');
        expect(html).not.toContain('<div id="root"></div>');
        expect(html).toContain("<script");
        expect(html).toContain(`<h1>${route.heading}</h1>`);
        expect(html).toContain(`data-template="${route.template}"`);

        expect(html).toContain(
            `<meta name="description" content="${escapeForAttribute(route.description)}"`
        );
    });
}

for (const route of prerenderedRoutes) {
    test(`${route.path} renders with JavaScript disabled`, async ({ page }) => {
        await page.goto(route.path);
        await expect(page).toHaveTitle(route.title);
        await expect(
            page.getByRole("heading", { level: 1, name: route.heading })
        ).toBeVisible();
        await expect(page.locator("main#main-content article")).toBeVisible();
    });
}

test("nav renders every configured link and marks the current one", async ({
    page,
}) => {
    for (const current of navLinks) {
        await page.goto(current.href);
        const nav = page.getByRole("navigation", { name: "Main" });
        await expect(nav.getByRole("link")).toHaveCount(navLinks.length);

        for (const item of navLinks) {
            const link = nav.getByRole("link", {
                name: item.label,
                exact: true,
            });
            await expect(link).toHaveAttribute("href", item.href);
            if (item.href === current.href) {
                await expect(link).toHaveAttribute("aria-current", "page");
            } else {
                await expect(link).not.toHaveAttribute("aria-current", "page");
            }
        }
    }
});

test("blog index lists published posts newest first", async ({ page }) => {
    await page.goto("/blog");
    const postLinks = page.locator("main article ul li a");
    await expect(postLinks).toHaveCount(postsNewestFirst.length);
    await expect(postLinks).toHaveText(postsNewestFirst);
});

test("drafts are excluded from the build", async ({ request }) => {
    for (const path of draftRoutes) {
        const response = await request.get(path);
        expect(response.status()).toBe(404);
    }
});

test("404.html exists and renders the notFound template", async ({
    page,
    request,
}) => {
    expect(existsSync(join(fixtureDistDir, "404.html"))).toBe(true);

    const missing = await request.get("/definitely-not-a-page");
    expect(missing.status()).toBe(404);
    expect(await missing.text()).toContain(`<title>${notFoundTitle}</title>`);

    const direct = await request.get("/404.html");
    expect(direct.status()).toBe(200);

    await page.goto("/404.html");
    await expect(page).toHaveTitle(notFoundTitle);
    await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" })
    ).toBeVisible();
    await expect(
        page.getByRole("link", { name: `Back to ${siteName}` })
    ).toHaveAttribute("href", "/");
});

test("gallery directive renders through the theme", async ({ page }) => {
    await page.goto("/gallery");
    const gallery = page.locator('[data-directive="gallery"]');
    await expect(gallery).toBeVisible();
    await expect(gallery.locator("img")).toHaveCount(3);
    await expect(gallery.locator("img").first()).toHaveAttribute(
        "src",
        "/assets/photo-teal.webp"
    );
});

test("themes receive every route with its resolved template", async ({
    page,
}) => {
    await page.goto("/");
    const siteMap = page.getByRole("navigation", { name: "All routes" });
    await expect(siteMap.getByRole("link")).toHaveText(routePathsInRouteOrder);
    for (const route of prerenderedRoutes) {
        await expect(
            siteMap.locator(`li:has(a[href="${route.path}"])`)
        ).toHaveAttribute("data-route-template", route.template);
    }
});

test("pages with an authored order precede unordered pages", async ({
    page,
}) => {
    await page.goto("/");
    const paths = await page
        .getByRole("navigation", { name: "All routes" })
        .getByRole("link")
        .allTextContents();
    expect(paths.slice(0, orderedRoutePaths.length)).toEqual(orderedRoutePaths);
    expect(paths.slice(orderedRoutePaths.length)).toEqual(unorderedRoutePaths);
});

test.describe("the markdown corpus", () => {
    test.beforeEach(async ({ page }) => {
        await page.goto("/markdown");
    });

    test("renders every heading level below the template h1", async ({
        page,
    }) => {
        await expect(page.locator("main h1")).toHaveCount(1);
        for (const level of [2, 3, 4, 5, 6]) {
            await expect(
                page.locator(`main h${String(level)}`).first()
            ).toBeVisible();
        }
    });

    test("renders nested and custom-start lists", async ({ page }) => {
        await expect(page.locator("main ul ul ul li")).toHaveText([
            "And a third level",
        ]);
        await expect(page.locator('main ol[start="7"] li')).toHaveCount(2);
        await expect(page.locator("main ul li p")).not.toHaveCount(0);
    });

    test("renders fenced code with and without a language", async ({
        page,
    }) => {
        await expect(page.locator("main pre code.language-ts")).toHaveText(
            "const answer: number = 42;"
        );
        await expect(page.locator("main pre code:not([class])")).toContainText(
            "A fence with no language"
        );
    });

    test("renders nested blockquotes, rules, and hard breaks", async ({
        page,
    }) => {
        await expect(page.locator("main blockquote blockquote p")).toHaveText(
            "Quotes nest, and hold paragraphs of their own."
        );
        await expect(page.locator("main hr")).toHaveCount(1);
        await expect(page.locator("main p br")).toHaveCount(1);
    });

    test("renders internal, external, titled, and reference links", async ({
        page,
    }) => {
        await expect(
            page.getByRole("link", { name: "internal link" })
        ).toHaveAttribute("href", "/about");
        await expect(
            page.getByRole("link", { name: "external link" })
        ).toHaveAttribute("href", "https://example.com");
        await expect(
            page.getByRole("link", { name: "titled link" })
        ).toHaveAttribute("title", "Example title");
        await expect(
            page.getByRole("link", { name: "an asset link" })
        ).toHaveAttribute("href", "/assets/squares.svg");
        await expect(
            page.getByRole("link", { name: "reference link" })
        ).toHaveAttribute("href", "https://github.com/nefantaris");
    });

    test("renders images including a resolved image reference", async ({
        page,
    }) => {
        await expect(page.locator("main article img")).toHaveCount(3);
        await expect(page.getByAltText("An amber placeholder")).toHaveAttribute(
            "src",
            "/assets/photo-amber.webp"
        );
        await expect(page.getByAltText("A teal placeholder")).toHaveAttribute(
            "title",
            "Rendered with a title attribute"
        );
    });

    test("renders a table with header cells and column alignment", async ({
        page,
    }) => {
        const table = page.locator("main table");
        await expect(table).toHaveCount(1);
        await expect(table.locator('thead th[scope="col"]')).toHaveText([
            "Construct",
            "Element",
            "Emitted by",
            "Notes",
        ]);
        await expect(table.locator("thead th").nth(0)).toHaveAttribute(
            "data-align",
            "left"
        );
        await expect(table.locator("thead th").nth(1)).toHaveAttribute(
            "data-align",
            "center"
        );
        await expect(table.locator("thead th").nth(2)).toHaveAttribute(
            "data-align",
            "right"
        );
        await expect(table.locator("thead th").nth(3)).not.toHaveAttribute(
            "data-align"
        );
        await expect(table.locator("tbody tr")).toHaveCount(3);
        await expect(
            table.locator("tbody tr").first().locator("td").nth(1)
        ).toHaveText("table");
    });

    test("wraps a table in a labelled, focusable scroll region", async ({
        page,
    }) => {
        const region = page.getByRole("region", { name: "Table" });
        await expect(region).toHaveAttribute("data-table-scroll", "");
        await expect(region).toHaveAttribute("tabindex", "0");
        await expect(region.locator("> table")).toHaveCount(1);
        await expect(page.locator("main table")).toHaveCount(1);
    });

    test("renders strikethrough and bare autolinks", async ({ page }) => {
        await expect(page.locator("main del")).toHaveText("struck through");
        await expect(
            page.getByRole("link", { name: "https://github.com/nefantaris" })
        ).toHaveAttribute("href", "https://github.com/nefantaris");
        await expect(
            page.getByRole("link", { name: "hello@nefantaris.dev" })
        ).toHaveAttribute("href", "mailto:hello@nefantaris.dev");
    });

    test("renders task lists as labelled, disabled checkboxes", async ({
        page,
    }) => {
        const boxes = page.locator(
            'main [data-task-item] > input[type="checkbox"]'
        );
        await expect(boxes).toHaveCount(3);
        await expect(boxes.nth(0)).toBeChecked();
        await expect(boxes.nth(1)).not.toBeChecked();
        await expect(boxes.nth(2)).toBeChecked();
        await expect(boxes.nth(0)).toBeDisabled();
        await expect(boxes.nth(0)).toHaveAttribute("aria-label", "Task");
        await expect(page.locator("main ul[data-task-list]")).toHaveCount(2);
    });

    test("hoists footnotes into one numbered section", async ({ page }) => {
        const references = page.locator("main a[data-footnote-ref]");
        await expect(references).toHaveText(["1", "1", "2"]);
        await expect(references.nth(0)).toHaveAttribute("href", "#footnote-1");
        await expect(references.nth(1)).toHaveAttribute(
            "id",
            "footnote-ref-1-2"
        );
        await expect(references.nth(2)).toHaveAttribute("href", "#footnote-2");

        const footnotes = page.locator("main section[data-footnotes]");
        await expect(
            footnotes.getByRole("heading", { level: 2, name: "Footnotes" })
        ).toBeVisible();
        await expect(footnotes.locator("ol > li")).toHaveCount(2);
        await expect(footnotes.locator("ol > li").nth(0)).toHaveAttribute(
            "id",
            "footnote-1"
        );
        await expect(
            footnotes.locator("ol > li").nth(1).locator("p")
        ).toHaveCount(2);
        await expect(footnotes.locator("a[data-footnote-backref]")).toHaveText([
            "↩",
            "↩2",
            "↩",
        ]);
    });

    test("leaves an inline directive as literal text", async ({ page }) => {
        await expect(page.locator("main article")).toContainText(
            "A stray :directive in prose is literal text"
        );
    });
});
