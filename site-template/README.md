# site-template

The internal site template for Nefantaris. nefantaris-core instantiates this project
for every user site build, and `nef eject` emits it as a standalone React
project. See [../BRIEF.md](../BRIEF.md) for the core's mission.

Built with React, TypeScript, Vite, Wouter, and Tailwind CSS. The build fills
in `src/theme/` (from the resolved theme) and `src/generated/content.ts` (from
the parsed content repo); the checked-in copies of both are minimal
placeholders that keep the template a valid standalone app.

- `src/nefantaris/` — contract types, the markdown-tree renderer, head handling
- `src/entry-server.tsx` — prerender entry (`render(path)`)
- `src/main.tsx` — hydrates prerendered HTML, falls back to client render

## Commands

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the Vite dev server        |
| `npm run build`        | Type-check and build to `dist/`  |
| `npm run preview`      | Preview the production build     |
| `npm run lint`         | Lint and auto-fix with ESLint    |
| `npm run lint:check`   | Lint without fixing              |
| `npm run format`       | Format with Prettier             |
| `npm run format:check` | Check formatting without writing |
