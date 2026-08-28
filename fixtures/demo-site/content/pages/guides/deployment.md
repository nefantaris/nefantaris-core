---
title: Deployment
description: A nested page, proving the route mirrors the file path.
---

This file lives at `content/pages/guides/deployment.md`, so its route is
`/guides/deployment`. Nested directories need no configuration.

1. Build the site with `nef build`.
2. Upload `dist/` to any static host.
3. Point the host at `404.html` for unknown routes.
