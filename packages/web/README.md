# @hashfriend/web

The Astro site. Pages are Markdown/MDX in `src/pages`, all on `layouts/Base.astro`.

`src/pages/og/[slug].png.ts` builds one Open Graph card per page from the same frontmatter — satori lays it out, resvg writes the PNG. It uses the vendored `src/assets/avatar.png` and the `firacode` TTF, since satori reads neither remote paths nor the woff2 the page loads.
