# nefantaris-core

The Nefantaris build engine. Takes a content-only repo (markdown + frontmatter,
assets, config, optional child theme) and produces a prerendered static React
site.

See [BRIEF.md](./BRIEF.md) for the mission and v1 scope.

## Commands

| Command             | Purpose                                             |
| ------------------- | --------------------------------------------------- |
| `npm run build`     | Compile the CLI to `dist/`                          |
| `npm run typecheck` | Type-check without emitting                         |
| `npm run dev`       | Run the `nef dev` server from source                |
| `npm run format`    | Format with Prettier (`format:check` to only check) |

## CLI

Once built, the engine is driven by `nef`:

| Command     | What it does                                             |
| ----------- | -------------------------------------------------------- |
| `nef build` | Build a site directory to static HTML                    |
| `nef dev`   | Serve the site with hot reload                           |
| `nef eject` | Emit the instantiated site as a standalone React project |

## Layout

| Path              | What lives there                                                    |
| ----------------- | ------------------------------------------------------------------- |
| `src/cli`         | `build`, `dev`, `eject` entry points                                |
| `src/content`     | Markdown + frontmatter parsing, directive handling                  |
| `src/themes`      | Parent-theme fetching and child-theme overlay                       |
| `src/prerender`   | Route-by-route static HTML rendering                                |
| `src/instantiate` | Injecting routes, content, and theme into the site template         |
| `site-template/`  | The internal Vite/React/Wouter/Tailwind app that builds instantiate |
| `examples/`       | Test fixtures (`demo-site`, `test-theme`)                           |

## License

MIT — see [LICENSE](./LICENSE).
