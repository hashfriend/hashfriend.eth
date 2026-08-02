// @ts-check
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import { defineConfig, fontProviders } from 'astro/config'
import relativeLinks from 'astro-relative-links'

// https://astro.build/config
export default defineConfig({
  // Canonical public URL; only used to build absolute sitemap entries. Pages
  // still link relatively (astro-relative-links) so they work on any gateway.
  site: 'https://hashfriend.eth.limo',
  integrations: [mdx(), sitemap(), relativeLinks()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Fira Code',
      cssVariable: '--font-fira-code',
      weights: ['400', '600']
    }
  ]
})
