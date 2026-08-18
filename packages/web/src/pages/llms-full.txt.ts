import type { APIRoute } from 'astro'
import { pages, text } from '../lib/pages'

export const GET: APIRoute = () =>
  text(pages.map((page) => page.markdown).join('\n---\n\n'))
