import type { APIRoute, GetStaticPaths } from 'astro'
import { type Page, pages, text } from '../lib/pages'

export const getStaticPaths = (() =>
  pages.map((page) => ({
    params: { slug: page.slug },
    props: page
  }))) satisfies GetStaticPaths

export const GET: APIRoute<Page> = ({ props }) => text(props.markdown)
