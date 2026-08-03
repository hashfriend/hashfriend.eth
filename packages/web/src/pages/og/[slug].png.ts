/**
 * The Open Graph card for every page, rasterised at build time.
 *
 * Satori lays the card out with real font metrics and outlines the text, then
 * resvg turns that SVG into the PNG the social crawlers actually accept.
 */

import { createRequire } from 'node:module'
import { Resvg } from '@resvg/resvg-js'
import type { APIRoute, GetStaticPaths } from 'astro'
import satori from 'satori'
// Satori resolves no paths, so the avatar comes in as a data URI.
import avatar from '../../assets/avatar.png?inline'

const WIDTH = 1200
const HEIGHT = 630
const PADDING = 88
const SITE_NAME = 'hashfriend.eth'
// The dark theme's background, lifted towards its link blue across the card.
const BACKGROUND =
  'linear-gradient(120deg, #121212 0%, #16191f 45%, #1b2634 100%)'
const TITLE_COLOR = '#e5e7eb'
const TEXT_COLOR = '#b9c0cb'
const ACCENT_COLOR = 'rgba(108, 182, 255, 0.35)'

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

type Card = { title: string; date?: string }

// The pages are the only source of titles, so the cards are built from them.
const pages = import.meta.glob<{
  url?: string
  frontmatter: { title?: string; date?: string }
}>('../*.{md,mdx}', { eager: true })

export const getStaticPaths = (() =>
  Object.values(pages).map(({ url, frontmatter }) => ({
    params: { slug: url?.replace(/^\/+|\/+$/g, '') || 'index' },
    props: {
      title: frontmatter.title ?? SITE_NAME,
      date: frontmatter.date
        ? new Date(frontmatter.date).toISOString().slice(0, 10)
        : undefined
    }
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

// Satori takes the shape JSX compiles to, which an endpoint cannot author.
type Node = { type: string; props: Record<string, unknown> }
const el = (
  style: Record<string, unknown>,
  children?: string | Node[]
): Node => ({ type: 'div', props: { style, children } })

function card({ title, date }: Card): Node {
  // Long titles step down so they keep filling the card without overflowing.
  const fontSize = title.length > 56 ? 60 : title.length > 30 ? 74 : 88
  // The untitled home card is the site name already; the wordmark would repeat it.
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
      ),

      el({ display: 'flex', flexDirection: 'column' }, [
        el({ height: 2, backgroundColor: ACCENT_COLOR }),
        el(
          { marginTop: 22, fontSize: 28, color: TEXT_COLOR },
          date ?? 'hashfriend.eth.limo'
        )
      ])
    ]
  )
}
