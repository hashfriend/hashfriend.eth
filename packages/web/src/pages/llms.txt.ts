import type { APIRoute } from 'astro'
import { href, posts, site, text } from '../lib/pages'

const entry = (title: string, url: string, description?: string) =>
  `- [${title}](${url})${description ? `: ${description}` : ''}`

export const GET: APIRoute = () =>
  text(
    `${[
      '# hashfriend.eth',
      site?.description && `> ${site.description}`,
      `Every page is also served as clean Markdown at the same URL with \`.md\` appended. [llms-full.txt](${href('/llms-full.txt')}) carries the full text of all of them in one file.`,
      '## Posts',
      posts
        .map((post) => entry(post.title, post.markdownUrl, post.description))
        .join('\n'),
      '## Optional',
      entry(
        'Home',
        site?.markdownUrl ?? href('/index.md'),
        'the index of everything published here'
      )
    ]
      .filter(Boolean)
      .join('\n\n')}\n`
  )
