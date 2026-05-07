import { chromium } from './node_modules/playwright/index.mjs'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').trim().split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const idx = l.indexOf('='); return [l.slice(0,idx), l.slice(idx+1)] })
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL        = 'fco.mtz.c@hotmail.com'
const SITE         = 'https://prop-admin-teal.vercel.app'
const PROJECT_REF  = new URL(SUPABASE_URL).hostname.split('.')[0]

async function getSession() {
  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: EMAIL })
  })
  const { action_link } = await linkRes.json()
  const verifyRes = await fetch(action_link, { redirect: 'manual' })
  const hashPart  = (verifyRes.headers.get('location') || '').split('#')[1] || ''
  const p = new URLSearchParams(hashPart)
  const accessToken  = p.get('access_token')
  const refreshToken = p.get('refresh_token')
  const jwt = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString())
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${accessToken}` }
  })
  const userProfile = await userRes.json()
  return {
    key: `sb-${PROJECT_REF}-auth-token`,
    value: { access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: jwt.exp, refresh_token: refreshToken, user: userProfile }
  }
}

const session = await getSession()
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
await ctx.addInitScript(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)) }, session)
const page = await ctx.newPage()

await page.goto(`${SITE}/payments`, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2500)

// Click Manuales tab
await page.getByText('Manuales').click()
await page.waitForTimeout(1200)

// Click the item text "prueba" to expand it
await page.getByText('prueba').click()
await page.waitForTimeout(1000)

await page.screenshot({ path: '/tmp/expanded.png', fullPage: true })

// Check the background color of the expanded dropdown div
const dropdownBg = await page.evaluate(() => {
  // Find the expanded dropdown — it's the div right after the click row inside ITEM_CARD
  const borders = document.querySelectorAll('[style*="border-top"]')
  for (const el of borders) {
    if (el.style.borderTop && el.style.padding) {
      return window.getComputedStyle(el).backgroundColor
    }
  }
  return 'not found'
})
console.log('Dropdown bg:', dropdownBg)

// Check hover effect: move to item row and check bg
const row = page.getByText('prueba').first()
await row.hover()
await page.waitForTimeout(300)
const rowBg = await page.evaluate(() => {
  const el = document.querySelector('[style*="cursor: pointer"]') || document.querySelector('[style*="cursor:pointer"]')
  return el ? window.getComputedStyle(el).backgroundColor : 'not found'
})
console.log('Row bg on hover:', rowBg)

await page.screenshot({ path: '/tmp/hover-check.png' })
await ctx.close()
await browser.close()
