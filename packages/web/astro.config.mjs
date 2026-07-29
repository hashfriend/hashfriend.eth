// @ts-check
import mdx from '@astrojs/mdx'
import { defineConfig, fontProviders } from 'astro/config'
import relativeLinks from 'astro-relative-links'

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), relativeLinks()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Fira Code',
      cssVariable: '--font-fira-code',
      weights: ['400', '600']
    }
  ]
})
