---
title: Introduction
description: The first page of an authored sequence, ordered ahead of its alphabetical neighbours.
order: 4
---

This page and [Installation](/guides/installation) carry an `order` in their
frontmatter, so the generated route list reads in the sequence an author would
write a guide in rather than the sequence the filenames happen to sort in.

[Deployment](/guides/deployment) declares no `order`, so it keeps the
alphabetical fallback and follows every ordered page.
