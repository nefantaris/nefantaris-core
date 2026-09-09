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

| Command                                                                     | What it does                                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `nef init [siteDir] [--theme <source>] [--theme-version <ref>]`             | Scaffold a site with starter content and a `package.json` with `dev`/`build` scripts                        |
| `nef build [siteDir]`                                                       | Build a site directory to static HTML                                                                       |
| `nef dev [siteDir]`                                                         | Serve the site with hot reload                                                                              |
| `nef inspect [siteDir] --json`                                              | Print the site's config, templates, and directives as JSON                                                  |
| `nef theme dev [themeDir]`                                                  | Preview a theme against the fixture corpus                                                                  |
| `nef theme check [themeDir]`                                                | Validate, typecheck, lint, and format-check a theme                                                         |
| `nef plugins add <name> [siteDir] [--source <url\|path>] [--version <ref>]` | Enable a plugin in the site's `nefantaris.json`, pinned to a tag or commit SHA when `--source` is a git URL |
| `nef eject [siteDir] [--out <dir>]`                                         | Emit the site as a standalone React project that builds without Nefantaris                                  |

## Running a site

A scaffolded site's `package.json` pins `@nefantaris/core` as a devDependency,
so inside the site `npm install` then `npm run dev` previews it and
`npm run build` writes the deployable site to `dist/`. Pass vite flags after
`--`, for example `npm run dev -- --port 3000`. Upgrade core with
`npm install --save-dev @nefantaris/core@latest`.

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
template, theme, parsed content, assets — to `<siteDir>/ejected/` (gitignored)
or the `--out` directory, which must be empty. Every package the enabled
plugins provide becomes an exact-pinned entry in the ejected `package.json`,
and the Vite aliases and tsconfig `paths` that pointed into the site's plugin
store are gone, so `npm install` then `npm run build` inside it prerenders
the same `dist/` that `nef build` produces, with no Nefantaris dependency.

## Layout

| Path                  | What lives there                                                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/cli`             | Entry points for `build`, `dev`, `eject`, `init`, `inspect`, `theme dev`, `theme check`, `plugins add`                                                                                                       |
| `src/config.ts`       | `nefantaris.json` — name, theme reference, `nav`, enabled plugins                                                                                                                                            |
| `src/manifest.ts`     | Shared reading and field validation for `theme.json` and `plugin.json`                                                                                                                                       |
| `src/content`         | Markdown + frontmatter parsing, directives, template names from the manifest                                                                                                                                 |
| `src/sources`         | The git snapshot resolver themes and plugins share — source syntax, the tag-or-SHA version rules, and the shallow per-site cache                                                                             |
| `src/themes`          | The git-pinned theme resolver and its per-site cache, manifest loading, the theme copy and child-theme overlay, the generated wiring module, contract types, and the fixture corpus a theme previews against |
| `src/plugins`         | Resolving the enabled set, enforcing a theme's `requires`, installing plugin dependencies into `.nefantaris/plugin-store/` inside the site, and emitting Vite aliases and tsconfig paths                     |
| `src/instantiate`     | Injecting routes, content, nav, theme, and plugins into the site template, and the eject variant that unwinds plugin aliases into real dependencies                                                          |
| `site-template/`      | The Vite/React/Wouter/Tailwind project every site is generated from; its `scripts/build.mjs` runs the client and SSR builds and prerenders every route                                                       |
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
