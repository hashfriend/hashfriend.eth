# @hashfriend/web

The Astro site. Pages are Markdown/MDX in `src/pages`, all on `layouts/Base.astro`, which reads `title`, `description`, `date` and `updated` from frontmatter.

Links are rewritten relative by `astro-relative-links` so a build works on any gateway, whatever path it is mounted at. The exceptions are the canonical link and the social image, which social crawlers cannot resolve relative — those are built absolute from `site` in `astro.config.mjs`.

## Open Graph cards

`src/pages/og/[slug].png.ts` renders one card per page at build time: satori lays it out and outlines the text, resvg turns that SVG into the PNG the crawlers accept. It takes its titles from the same `src/pages/*.{md,mdx}` frontmatter, so a new page gets a card without touching it.

## The avatar

A 256px copy of the NFT image is vendored at `src/assets/avatar.png`, so neither the page nor the card depends on an IPFS gateway being up at build or at load. `Header.astro` hands it to `astro:assets`, which emits a 64px webp — twice the 32px it is drawn at, about 1.4 kB. The card imports it with Vite's `?inline` instead, because satori resolves no paths and needs a data URI.

Astro also copies that source into `_astro/` next to the webp, so every build ships ~40 kB that nothing references.

Fira Code reaches the card and the page by different routes, on purpose. The page uses Astro's Google provider, which ships a 36 kB subsetted woff2. The card uses the `firacode` package's TTF, because satori cannot parse woff2 and Astro does not subset local fonts — unifying on the package would triple what a visitor downloads, and the npm copy never leaves the build.
