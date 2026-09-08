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

| Command                                 | What it does                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `nef init [siteDir] [--theme <source>]` | Scaffold a site with starter content and a `package.json` with `dev`/`build` scripts |
| `nef build [siteDir]`                   | Build a site directory to static HTML                                                |
| `nef dev [siteDir]`                     | Serve the site with hot reload                                                       |
| `nef inspect [siteDir] --json`          | Print the site's config, templates, and directives as JSON                           |
| `nef theme dev [themeDir]`              | Preview a theme against the fixture corpus                                           |
| `nef theme check [themeDir]`            | Validate, typecheck, lint, and format-check a theme                                  |
| `nef plugins add <name> [siteDir]`      | Enable a plugin in the site's `nefantaris.json`                                      |
| `nef eject [siteDir]`                   | Emit the site as a standalone React project — not built yet                          |

## Running a site

A scaffolded site's `package.json` pins `@nefantaris/core` as a devDependency,
so inside the site `npm install` then `npm run dev` previews it and
`npm run build` writes the deployable site to `dist/`. Pass vite flags after
`--`, for example `npm run dev -- --port 3000`. Upgrade core with
`npm install --save-dev @nefantaris/core@latest`.

## Layout

| Path                  | What lives there                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli`             | Entry points for `build`, `dev`, `theme dev`, `theme check`, `plugins add`                                                                                    |
| `src/config.ts`       | `nefantaris.json` — name, theme source, `nav`, enabled plugins                                                                                                |
| `src/manifest.ts`     | Shared reading and field validation for `theme.json` and `plugin.json`                                                                                        |
| `src/content`         | Markdown + frontmatter parsing, directives, template names from the manifest                                                                                  |
| `src/themes`          | Manifest loading, the theme copy and child-theme overlay, the generated wiring module, contract types, and the fixture corpus a theme previews against        |
| `src/plugins`         | Resolving the enabled set, enforcing a theme's `requires`, installing plugin dependencies into `.plugin-store/`, and emitting Vite aliases and tsconfig paths |
| `src/instantiate`     | Injecting routes, content, nav, theme, and plugins into the site template                                                                                     |
| `src/prerender`       | The Vite client and SSR builds, then route-by-route static HTML rendering                                                                                     |
| `site-template/`      | The Vite/React/Wouter/Tailwind project every site is generated from                                                                                           |
| `fixtures/demo-site`  | The fixture corpus — a content-only site covering every markdown construct, template, and directive                                                           |
| `fixtures/test-theme` | A minimal theme in the manifest shape, the one `demo-site` builds against                                                                                     |
| `e2e/`                | Playwright specs and the static server they share with Lighthouse                                                                                             |

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
