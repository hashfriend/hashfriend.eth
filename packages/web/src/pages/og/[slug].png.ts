import { createRequire } from 'node:module'
import { Resvg } from '@resvg/resvg-js'
import type { APIRoute, GetStaticPaths } from 'astro'
import satori from 'satori'
import avatar from '../../assets/avatar.png?inline'

const WIDTH = 1200
const HEIGHT = 630
const PADDING = 88
const SITE_NAME = 'hashfriend.eth'
const BACKGROUND =
  'linear-gradient(120deg, #121212 0%, #16191f 45%, #1b2634 100%)'
const TITLE_COLOR = '#e5e7eb'
const TEXT_COLOR = '#b9c0cb'

const require = createRequire(import.meta.url)
const fonts = Promise.all(
  (
    [
      ['firacode/distr/ttf/FiraCode-Regular.ttf', 400],
      ['firacode/distr/ttf/FiraCode-SemiBold.ttf', 600]
    ] as const
  ).map(async ([path, weight]) => ({
    name: 'Fira Code',
    weight,
    style: 'normal' as const,
    data: await Bun.file(require.resolve(path)).arrayBuffer()
  }))
)

type Card = { title: string }

const pages = import.meta.glob<{
  url?: string
  frontmatter: { title?: string }
}>('../*.{md,mdx}', { eager: true })

export const getStaticPaths = (() =>
  Object.values(pages).map(({ url, frontmatter }) => ({
    params: { slug: url?.replace(/^\/+|\/+$/g, '') || 'index' },
    props: { title: frontmatter.title ?? SITE_NAME }
  }))) satisfies GetStaticPaths

export const GET: APIRoute<Card> = async ({ props }) => {
  const svg = await satori(card(props), {
    width: WIDTH,
    height: HEIGHT,
    fonts: await fonts
  })

  return new Response(new Uint8Array(new Resvg(svg).render().asPng()), {
    headers: { 'Content-Type': 'image/png' }
  })
}

type Node = { type: string; props: Record<string, unknown> }
const el = (
  style: Record<string, unknown>,
  children?: string | Node[]
): Node => ({ type: 'div', props: { style, children } })

function card({ title }: Card): Node {
  const fontSize = title.length > 56 ? 60 : title.length > 30 ? 74 : 88
  const wordmark = title !== SITE_NAME

  return el(
    {
      width: WIDTH,
      height: HEIGHT,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: PADDING,
      backgroundImage: BACKGROUND,
      color: TITLE_COLOR,
      fontFamily: 'Fira Code'
    },
    [
      el({ display: 'flex', alignItems: 'center' }, [
        {
          type: 'img',
          props: {
            src: avatar,
            width: 88,
            height: 88,
            style: {
              borderRadius: 44,
              border: `2px solid ${TEXT_COLOR}`
            }
          }
        },
        ...(wordmark
          ? [el({ marginLeft: 24, fontSize: 32, fontWeight: 600 }, SITE_NAME)]
          : [])
      ]),

      el(
        {
          display: 'flex',
          fontSize,
          fontWeight: 600,
          lineHeight: 1.18,
          letterSpacing: -1
        },
        title
      )
    ]
  )
}
