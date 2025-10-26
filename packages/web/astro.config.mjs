// @ts-check
import mdx from '@astrojs/mdx'
import { defineConfig, fontProviders } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  integrations: [mdx()],
  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: 'Fira Code',
        cssVariable: '--font-fira-code',
        weights: ['400', '600']
      }
    ]
  }
})
