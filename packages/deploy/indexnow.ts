// Notifies IndexNow search engines (Bing, Yandex, Seznam, Naver, Yep — not
// Google) that one or more URLs changed. Ownership is proven by a key file
// served at the site root; run this after a deploy has propagated to eth.limo.

export {}

const KEY = 'c0394f133a9b0909f8ddce29b8913179'
const HOST = 'hashfriend.eth.limo'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`
const ENDPOINT = 'https://api.indexnow.org/indexnow'

const urls = process.argv.slice(2).filter((a) => !a.startsWith('-'))

if (urls.length === 0) {
  console.error(
    `❌ Usage: bun indexnow.ts <url> [url...]\n   e.g. bun indexnow.ts https://${HOST}/singularity-finance-exploit/`
  )
  process.exit(1)
}

// The key file lags behind a deploy while eth.limo resolves the new IPNS
// record. Submitting before it serves gets the batch rejected (403), so wait.
async function keyIsLive() {
  try {
    const res = await fetch(KEY_LOCATION, {
      signal: AbortSignal.timeout(20000)
    })
    return res.ok && (await res.text()).trim() === KEY
  } catch {
    return false
  }
}

for (let i = 1; i <= 40; i++) {
  if (await keyIsLive()) break
  if (i === 40) {
    console.error(
      `❌ ${KEY_LOCATION} never served the key; is the deploy live?`
    )
    process.exit(1)
  }
  console.log(`⏳ key not live on ${HOST} yet (check ${i}); retrying in 90s`)
  await Bun.sleep(90000)
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: urls
  })
})

console.log(`📨 IndexNow responded ${res.status} ${res.statusText}`)
console.log(await res.text())
if (!res.ok && res.status !== 202) process.exit(1)
