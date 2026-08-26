# nefantaris-core

## Mission

The build engine. Takes a content-only repo (markdown + frontmatter, assets, config, optional child theme) and produces a prerendered static React site. Everything else in Nefantaris exists around this.

## v1 scope

- CLI: `nef build`, `nef dev`, `nef eject`
- Content pipeline: markdown + YAML frontmatter through remark, with directive syntax (`::name`) mapping to theme/plugin components
- Theme resolution: fetch the parent theme from git at the pinned version in config, overlay the local child-theme folder (child file shadows parent file by path)
- Site instantiation: inject routes, content, and theme into `site-template/` (the internal Vite/React/Wouter/Tailwind app)
- Prerender: every route rendered to a static HTML file that hydrates client-side
- `dev`: the same site with hot reload, embeddable by the editor
- `eject`: emit the instantiated site template as a standalone React project with no Nefantaris dependency
- Runs cleanly as a Cloudflare Pages build command (`npx nef build`)
- Plugin contract groundwork: directives, build hooks, and a way for a plugin to contribute Pages Functions

## Non-goals (v1)

- MDX or arbitrary code in content
- Incremental builds, image CDNs, i18n
- Anything interactive at runtime beyond hydration

## Open questions

- Config file format and name (JSON is friendliest for tooling; the editor edits it via UI either way)
- Prerender mechanism: Vite SSR renders per route vs `react-dom/server` over a route manifest
- How theme repos are fetched and cached (shallow clone vs tarball download; cache location; offline behavior)
- How `eject` bakes content in: generated TSX per page vs content as imported data
- What exactly a theme exports (define the contract together with nefantaris-theme-base)

## Layout

`src/cli`, `src/content`, `src/themes`, `src/prerender` are the intended module boundaries. `site-template/` is the app that builds instantiate and eject emits — keep it a blank, boring, excellent React app.
