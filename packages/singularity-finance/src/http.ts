export const userAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15'

export async function requestText(
  url: string,
  init: RequestInit = {}
): Promise<string> {
  const parsed = new URL(url)
  if (!['https:', 'http:'].includes(parsed.protocol))
    throw new Error('Expected an HTTP(S) URL')
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...Object.fromEntries(new Headers(init.headers)),
        'User-Agent': userAgent
      },
      signal: AbortSignal.timeout(20_000)
    })
    const body = await response.text()
    if (response.ok) return body
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await Bun.sleep(500 * (attempt + 1))
      continue
    }
    throw new Error(`HTTP ${response.status}: ${body}`)
  }
  throw new Error('HTTP retry limit reached')
}

export async function requestJson(
  url: string,
  init?: RequestInit
): Promise<unknown> {
  return JSON.parse(await requestText(url, init))
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected an object response')
  return value as Record<string, unknown>
}
