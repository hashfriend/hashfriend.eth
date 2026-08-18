const SITE = import.meta.env.SITE

export const href = (path: string) => new URL(path, SITE).href

type Frontmatter = {
  title?: string
  description?: string
  date?: string
  updated?: string
}

const modules = import.meta.glob<{ url?: string; frontmatter: Frontmatter }>(
  '../pages/*.{md,mdx}',
  { eager: true }
)
const sources = import.meta.glob<string>('../pages/*.{md,mdx}', {
  query: '?raw',
  import: 'default',
  eager: true
})

export type Page = {
  slug: string
  url: string
  markdownUrl: string
  title: string
  description?: string
  date?: string
  updated?: string
  markdown: string
}

const day = (value?: string) =>
  value ? new Date(value).toISOString().slice(0, 10) : undefined

// The frontmatter block, the MDX imports, and any JSX left in the prose. What
// remains is the same text the page renders, without the machinery.
const body = (source: string) =>
  source
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
    .replace(/^import\s.*$/gm, '')
    .replace(/[ \t]*<[A-Z][\w.]*(\s[^>]*)?\/>/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

// Root-relative links only resolve against a host, and these files are read
// detached from the page that served them.
const absolute = (markdown: string) =>
  markdown.replace(/\]\(\/(?!\/)/g, `](${SITE}/`)

function toPage(path: string): Page {
  const { url, frontmatter } = modules[path]
  const slug = url?.replace(/^\/+|\/+$/g, '') || 'index'
  const title = frontmatter.title ?? 'hashfriend.eth'
  const date = day(frontmatter.date)
  const updated = day(frontmatter.updated)

  const header = [
    `# ${title}`,
    frontmatter.description && `> ${frontmatter.description}`,
    [
      date && `Published: ${date}`,
      updated && `Last updated: ${updated}`,
      `Source: ${href(url ?? '/')}`
    ]
      .filter(Boolean)
      .join('  \n')
  ]
    .filter(Boolean)
    .join('\n\n')

  return {
    slug,
    url: href(url ?? '/'),
    markdownUrl: href(`/${slug}.md`),
    title,
    description: frontmatter.description,
    date,
    updated,
    markdown: `${header}\n\n${absolute(body(sources[path]))}\n`
  }
}

// Newest first, with the undated index page last.
export const pages: Page[] = Object.keys(modules)
  .map(toPage)
  .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

export const site = pages.find((page) => page.slug === 'index')
export const posts = pages.filter((page) => page.slug !== 'index')

export const text = (body: string) =>
  new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
  })
