# @hashfriend/web

The Astro site. Pages are Markdown/MDX in `src/pages`, all on `layouts/Base.astro`.

`src/lib/pages.ts` reads those same files raw, strips the frontmatter and the MDX machinery, and rewrites root-relative links to absolute ones. That text is served three ways: `/{slug}.md` per page (`src/pages/[...slug].md.ts`), `/llms.txt` as an annotated index, and `/llms-full.txt` as one concatenated file. `Base.astro` points at the per-page copy from `<link rel="alternate" type="text/markdown">` and from a visually hidden line in the body, since the site is static and cannot send a `Link` header or negotiate on `Accept`.

`src/pages/og/[slug].png.ts` builds one Open Graph card per page from the same frontmatter — satori lays it out, resvg writes the PNG. It uses the vendored `src/assets/avatar.png` and the `firacode` TTF, since satori reads neither remote paths nor the woff2 the page loads.
