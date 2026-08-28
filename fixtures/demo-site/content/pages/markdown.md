---
title: Markdown reference
description: Every markdown construct the Nefantaris content pipeline emits.
order: 2
---

Templates render `meta.title` as the page h1, so a body starts at h2. Prose can
be _emphasised_, **strong**, or `inline code`. A stray :directive in prose is
literal text, because only block directives map to components.

## Headings

### Third level

#### Fourth level

##### Fifth level

###### Sixth level

## Lists

- A bullet
- Another bullet
    - A nested bullet
    - With a sibling of its own
        - And a third level
- Back to the top level

1. Parse the markdown
2. Render the content tree
3. Prerender every route

### Numbered from a custom start

7. Ordered lists can start anywhere
8. And keep counting

### Items with more than one block

- A list item that holds two paragraphs.

    The second paragraph makes the item loose.

- A shorter sibling.

## Blockquotes

> Content is data. The theme decides what it looks like.
>
> > Quotes nest, and hold paragraphs of their own.

## Code

```ts
const answer: number = 42;
```

```
A fence with no language, so the code element gets no class.
```

## Rules and line breaks

---

A line that ends in a hard break\
continues on the next line inside the same paragraph.

## Links

An [internal link](/about) becomes a client-side route. An
[external link](https://example.com) and a [titled link](https://example.com "Example title")
stay plain anchors, and so does [an asset link](/assets/squares.svg).

A [reference link][nefantaris] resolves through a definition at the bottom of
the file.

## Images

![Two placeholder squares](/assets/squares.svg)

![A teal placeholder](/assets/photo-teal.webp "Rendered with a title attribute")

![An amber placeholder][amber]

## Tables

| Construct     | Element | Emitted by | Notes                                              |
| :------------ | :-----: | ---------: | -------------------------------------------------- |
| Table         | `table` |        GFM | Header row is `thead`                              |
| Strikethrough |  `del`  |        GFM | Wraps **inline** content                           |
| Task list     |  `ul`   |        GFM | See [the GFM spec](https://github.github.com/gfm/) |

## Strikethrough and autolinks

Text can be ~~struck through~~ mid-sentence. A bare URL such as
https://github.com/nefantaris becomes a link, and so does an address like
hello@nefantaris.dev.

## Task lists

- [x] Parse the GFM extensions
- [ ] Style them in a theme
    - [x] Nested task items keep their own state

## Footnotes

Definitions are collected at the end of the page[^pipeline], and a second
reference to the same note reuses its number[^pipeline]. A definition can hold
more than one block[^blocks].

[nefantaris]: https://github.com/nefantaris "Nefantaris on GitHub"
[amber]: /assets/photo-amber.webp "Resolved from an image reference"

[^pipeline]:
    Core hoists every definition into one ordered list, numbered by
    order of first reference.

[^blocks]: The body of a definition is ordinary markdown.

    A second paragraph proves it, and the back-reference lands at the end.
