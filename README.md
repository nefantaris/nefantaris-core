# nefantaris-core

The Nefantaris build engine. Takes a content-only repo (markdown + frontmatter,
assets, config, optional child theme) and produces a prerendered static React
site.

See [BRIEF.md](./BRIEF.md) for the mission and v1 scope. The `theme.json` and
`plugin.json` manifests core reads are specified in `THEME-CONTRACT.md`.

## Commands

| Command                 | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `npm run build`         | Compile the CLI to `dist/`                                   |
| `npm run typecheck`     | Type-check the CLI and the Playwright suite without emitting |
| `npm run dev`           | Run the `nef dev` server from source                         |
| `npm run build:fixture` | Build `fixtures/demo-site` to static HTML                    |
| `npm run serve:fixture` | Serve that build on `http://localhost:4173`                  |
| `npm run test:e2e`      | Rebuild the fixture, then run Playwright                     |
| `npm run test:e2e:ui`   | The same suite in the Playwright UI                          |
| `npm run lighthouse`    | Rebuild the fixture, then assert `lighthouserc.json`         |
| `npm run format`        | Format with Prettier (`format:check` to only check)          |

## CLI

Once built, the engine is driven by `nef`:

| Command                                                                              | What it does                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nef init [siteDir] [--theme <source>] [--theme-version <ref>] [--name <site name>]` | Scaffold a site with starter content and a `package.json` with `dev`/`build` scripts. The site is named after its folder unless `--name` says otherwise |
| `nef build [siteDir]`                                                                | Build a site directory to static HTML                                                                                                                   |
| `nef dev [siteDir]`                                                                  | Serve the site with hot reload                                                                                                                          |
| `nef inspect [siteDir] --json`                                                       | Print the site's config, templates, and directives as JSON                                                                                              |
| `nef doctor [siteDir] [--json]`                                                      | Check the site without building: broken links and missing images are errors, everything else is advice                                                  |
| `nef theme dev [themeDir]`                                                           | Preview a theme against the fixture corpus                                                                                                              |
| `nef theme check [themeDir]`                                                         | Validate, typecheck, lint, and format-check a theme                                                                                                     |
| `nef plugins add <name> [siteDir] [--source <url\|path>] [--version <ref>]`          | Enable a plugin in the site's `nefantaris.json`, pinned to a tag or commit SHA when `--source` is a git URL                                             |
| `nef eject [siteDir] [--out <dir>]`                                                  | Emit the site as a standalone React project that builds without Nefantaris                                                                              |

## Running a site

A scaffolded site's `package.json` pins `@nefantaris/core` as a devDependency,
so inside the site `npm install` then `npm run dev` previews it and
`npm run build` writes the deployable site to `dist/`. Pass vite flags after
`--`, for example `npm run dev -- --port 3000`. Upgrade core with
`npm install --save-dev @nefantaris/core@latest`.

A `public/` directory in the site is copied to the root of the built site,
site files winning over the template's, so `robots.txt`, `_redirects`,
`_headers`, and `.well-known/` land where hosts expect them. The first of
`favicon.svg`, `favicon.png`, `favicon.webp`, or `favicon.ico` found there
becomes the site icon. Two entries are build errors: `public/assets`, because
`/assets/` is where the site's `assets/` directory is served, and
`public/index.html`, because it would replace the generated home page. Like
`assets/`, `public/` is copied when core starts, so `nef dev` needs a restart
after adding files there.

## Site url, head tags, and sitemap

Two optional keys in `nefantaris.json` describe the published site:

```json
{
    "url": "https://example.com",
    "image": "/og.png"
}
```

`url` is the address the site is served from: an absolute `http` or `https`
URL with no path, query, or fragment. Core stores its origin form, so
`https://Example.com/` becomes `https://example.com`. It comes from this key
and nowhere else; core reads no environment variable for it. `image` is the
default share image, a path such as `/og.png` (a file in `public/`) or
`/assets/cover.webp`, or an absolute URL. A page or post overrides it with an
`image` key in its frontmatter.

Every page gets a title, its description, `og:title`, `og:site_name`,
`og:type` (`article` when the page has a `date`, otherwise `website`),
`og:description` and `twitter:description` when it has a description, and
`twitter:card`. Everything absolute needs `url`: with it, a page also gets
`<link rel="canonical">`, `og:url`, and, when a page or site image is set,
`og:image`, `twitter:image`, and `twitter:card` `summary_large_image` instead
of `summary`. Canonical urls end in a slash (`https://example.com/about/`),
the address a static host serves `about/index.html` from without a redirect.
Without `url` none of those are emitted, never as relative urls. `404.html`
gets `robots` `noindex` and no canonical.

With `url`, `nef build` also writes `sitemap.xml` to `dist/`: every published
page and post sorted by path, with `lastmod` taken from a `date` in
frontmatter and never from file times. Without `url` there is no sitemap.
Core always generates a `robots.txt` that allows everything, plus a
`Sitemap:` line when `url` is set. A `robots.txt` or `sitemap.xml` in the
site's `public/` replaces the generated one.

## Site language

`lang` in `nefantaris.json` is the language the site is written in, as a
BCP 47 tag:

```json
{
    "lang": "fr-CA"
}
```

It must be well formed by `Intl.getCanonicalLocales`, and core stores the
canonical form, so `"pt-br"` becomes `"pt-BR"`; anything else stops
`nef build`, `nef dev`, `nef eject`, and `nef inspect` at config load, naming
the key. It becomes the `lang` on the `<html>` tag of every page, in
`nef dev`, the build, and an ejected project. Without it the tag says
`lang="en"`. `nef inspect --json` reports `site.lang` when it is set.

## Checking a site

`nef doctor [siteDir]` reads the site the way `nef build` does, without
building it, and reports what would make it better. A finding is either an
**error**, which makes the command exit 1, or **advice**, which does not.
`nef build` prints the same findings as warnings after the build and never
fails because of them, so nothing gates a deploy unless a site chooses to run
`nef doctor` in its own CI.

| Rule                        | Severity | Fires when                                                                                                          |
| --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `site/parse`                | error    | `nefantaris.json`, the theme, or a content file cannot be read; the report has only this finding                    |
| `links/broken-link`         | error    | A content link or nav `href` matches no page, or an `/assets/` link matches no file                                 |
| `images/missing-file`       | error    | A content image, a frontmatter `image`, or the site `image` matches no file in `assets/` or `public/`               |
| `meta/no-url`               | advice   | `nefantaris.json` has no `url`                                                                                      |
| `meta/no-og-image`          | advice   | There is no site `image` and at least one page has no `image` of its own                                            |
| `meta/description-missing`  | advice   | A page or post has no `description`                                                                                 |
| `meta/description-short`    | advice   | A description is under 50 characters                                                                                |
| `meta/description-long`     | advice   | A description is over 160 characters                                                                                |
| `images/not-webp`           | advice   | A PNG, JPEG, GIF, or BMP is in `assets/`                                                                            |
| `images/large-file`         | advice   | An image in `assets/` is over 300 KB                                                                                |
| `images/large-dimensions`   | advice   | A PNG, JPEG, GIF, or WebP in `assets/` is over 2400 pixels on its longest side                                      |
| `images/unreferenced-asset` | advice   | Nothing in the content, nav, `image` keys, theme, child theme, or `public/` text files mentions a file in `assets/` |
| `a11y/empty-alt`            | advice   | A content image has empty alt text                                                                                  |
| `a11y/heading-skip`         | advice   | A heading is more than one level below the one before it, counting the page title as level 1                        |
| `a11y/vague-link-text`      | advice   | A link's text is empty or says nothing about where it goes ("click here", "read more", "here")                      |

Links resolve the way the built site does. A link starting with `/` outside
`/assets/` is routed as a page, so it must match a route: a trailing slash,
query, or fragment is ignored, and a file in `public/` does not count, because
clicking it shows the not-found page. Relative links resolve against the
page's own address with its trailing slash, and they and absolute links to the
site's own `url` may also point at a file. Links to other sites are not
checked. Images may be in `assets/` or `public/`. Generated pages count, so
`/blog` is a route when the site has posts.

`--json` prints a report the editor reads:

```json
{
    "contract": 1,
    "errors": 1,
    "advice": 1,
    "findings": [
        {
            "severity": "error",
            "rule": "links/broken-link",
            "message": "\"/abuot\" matches no page.",
            "file": "content/pages/index.md"
        },
        {
            "severity": "advice",
            "rule": "meta/description-short",
            "message": "The description is 31 characters; 50–160 gives search results and shared links enough to show.",
            "file": "content/posts/hello-world.md",
            "key": "description"
        }
    ]
}
```

`file` is relative to the site, with forward slashes. `key` is the frontmatter
key or the `nefantaris.json` path (`nav[2].href`) to fix, when there is one.
Rule ids are stable; messages are for people and may change. Errors come
first, then advice; within each, findings are grouped by namespace (`site`,
`meta`, `links`, `images`, `a11y`) and then sorted by file.

## Themes from git

`theme.source` is either a path relative to the site or a git URL. A git
source needs `theme.version`, which must be a tag or a full commit SHA:

```json
{
    "theme": {
        "source": "https://github.com/nefantaris/nefantaris-theme-base.git",
        "version": "v0.1.0"
    }
}
```

Core fetches that ref once, as a shallow snapshot, into
`.nefantaris/themes/` inside the site and reuses it for every later build,
so a site that has built once keeps building offline. A version that is a
branch name is rejected — a moving ref cannot be reproduced, and a cached
copy of it would go silently stale. A path source keeps `"version": "local"`
(or omits it) and is read straight from disk, which is how `nef theme dev` and
a sibling theme checkout keep working. `nef init --theme <git url>
--theme-version <ref>` scaffolds a site pinned this way.

## Plugins from git

A `plugins` entry in `nefantaris.json` is either a plain name, which core
looks up in the site's `plugins/` and `node_modules/`, then as a sibling
directory of the site, or an object that pins the plugin to a source of its
own:

```json
{
    "plugins": [
        "nefantaris-plugin-local",
        {
            "name": "nefantaris-plugin-gallery",
            "source": "https://github.com/nefantaris/nefantaris-plugin-gallery.git",
            "version": "v1.2.0"
        }
    ]
}
```

The version rules are the theme's: a git source needs a tag or a full commit
SHA, and a path source keeps `"version": "local"` (or omits it). Core
snapshots a git plugin into `.nefantaris/plugins/` inside the site, the same
shallow cache themes get, and installs every package the enabled plugins
declare into `.nefantaris/plugin-store/` inside the site. Nothing lands
outside the site, so `rm -rf .nefantaris` resets both and the next build
refills them.

`nef plugins add <name> [siteDir] --source <url> --version <ref>` writes the
object form and refuses a name the plugin's own manifest disagrees with.

A theme pins the plugins it `requires` the same way, except that a `requires`
source must be a git URL — a path pin would not survive the theme being used
from anywhere else. `nef init` copies those entries into the new site's
`plugins` verbatim, pins included, and a site entry wins over the theme's
by name.

## Ejecting

`nef eject [siteDir] [--out <dir>]` writes the fully instantiated project —
template, theme, parsed content, assets, public files — to
`<siteDir>/ejected/` (gitignored) or the `--out` directory, which must be
empty. Every package the enabled plugins provide becomes an exact-pinned entry
in the ejected `package.json`, and the Vite aliases and tsconfig `paths` that
pointed into the site's plugin store are gone, so `npm install` then
`npm run build` inside it prerenders the same `dist/` that `nef build`
produces, with no Nefantaris dependency.

## Layout

| Path                  | What lives there                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/cli`             | Entry points for `build`, `dev`, `doctor`, `eject`, `init`, `inspect`, `theme dev`, `theme check`, `plugins add`                                                                                             |
| `src/config.ts`       | `nefantaris.json` — name, theme reference, `nav`, enabled plugins, site `url`, `image`, and `lang`                                                                                                           |
| `src/check`           | `nef doctor`'s rules over the parsed site, one walker over the content tree, the image header reader, and the report                                                                                         |
| `src/siteUrl.ts`      | Validating and normalising the site `url`, and the image-reference rule config and frontmatter share                                                                                                         |
| `src/manifest.ts`     | Shared reading and field validation for `theme.json` and `plugin.json`                                                                                                                                       |
| `src/content`         | Markdown + frontmatter parsing, directives, template names from the manifest                                                                                                                                 |
| `src/sources`         | The git snapshot resolver themes and plugins share — source syntax, the tag-or-SHA version rules, and the shallow per-site cache                                                                             |
| `src/themes`          | The git-pinned theme resolver and its per-site cache, manifest loading, the theme copy and child-theme overlay, the generated wiring module, contract types, and the fixture corpus a theme previews against |
| `src/plugins`         | Resolving the enabled set, enforcing a theme's `requires`, installing plugin dependencies into `.nefantaris/plugin-store/` inside the site, and emitting Vite aliases and tsconfig paths                     |
| `src/instantiate`     | Injecting routes, content, nav, theme, and plugins into the site template, and the eject variant that unwinds plugin aliases into real dependencies                                                          |
| `site-template/`      | The Vite/React/Wouter/Tailwind project every site is generated from; its `scripts/build.mjs` runs the client and SSR builds, prerenders every route, and writes `sitemap.xml` when the site has a `url`      |
| `fixtures/demo-site`  | The fixture corpus — a content-only site covering every markdown construct, template, and directive                                                                                                          |
| `fixtures/test-theme` | A minimal theme in the manifest shape, the one `demo-site` builds against                                                                                                                                    |
| `e2e/`                | Playwright specs and the static server they share with Lighthouse                                                                                                                                            |

## Testing

Both suites build `fixtures/demo-site` first and run against that output, so
they cover the real prerendered HTML rather than an approximation of it.

- `npm run test:e2e` runs two Playwright projects: `prerendered` visits the
  build with JavaScript disabled, `hydrated` checks hydration and client-side
  navigation.
- `npm run lighthouse` runs Lighthouse CI over five routes and asserts the
  thresholds in [lighthouserc.json](./lighthouserc.json).

## Publishing

Releases happen in CI only — nobody publishes from a laptop. Bump the version,
merge to `main`, then push a matching tag:

```
npm version minor
git push --follow-tags
```

`.github/workflows/publish.yml` refuses to run if the tag and the manifest
version disagree, and skips the publish entirely if that version is already on
the registry, so a re-run after a partial failure is safe.

Authentication is npm trusted publishing (OIDC) — there is no npm token in
this repository. The package needs a trusted publisher on npmjs.com pointing
at `nefantaris/nefantaris-core` and the workflow filename `publish.yml`; the
fields are case-sensitive and must match exactly. Provenance attestations are
generated automatically.

The `files` field is deliberately narrow: `dist`, `site-template`, and
`fixtures/demo-site`. That last one is a runtime asset, not test data —
`nef theme dev` copies it to materialize a preview site — so removing it
breaks theme development.

## License

MIT — see [LICENSE](./LICENSE).
