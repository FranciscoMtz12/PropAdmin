import { chromium } from './node_modules/playwright/index.mjs'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync('.env.local','utf8').trim().split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)] })
)
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL        = 'fco.mtz.c@hotmail.com'
const SITE         = 'https://prop-admin-teal.vercel.app'
const PROJECT_REF  = new URL(SUPABASE_URL).hostname.split('.')[0]

async function getSession() {
  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method:'POST', headers:{ apikey:SERVICE_KEY, Authorization:`Bearer ${SERVICE_KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ type:'magiclink', email:EMAIL })
  })
  const { action_link } = await linkRes.json()
  const verifyRes = await fetch(action_link, { redirect:'manual' })
  const hashPart  = (verifyRes.headers.get('location')||'').split('#')[1]||''
  const p = new URLSearchParams(hashPart)
  const accessToken  = p.get('access_token')
  const refreshToken = p.get('refresh_token')
  const jwt = JSON.parse(Buffer.from(accessToken.split('.')[1],'base64url').toString())
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers:{ apikey:SERVICE_KEY, Authorization:`Bearer ${accessToken}` } })
  const userProfile = await userRes.json()
  return { key:`sb-${PROJECT_REF}-auth-token`, value:{ access_token:accessToken, token_type:'bearer', expires_in:3600, expires_at:jwt.exp, refresh_token:refreshToken, user:userProfile } }
}

const session = await getSession()
const browser = await chromium.launch({ headless:true })

async function page_shot(tab, outPath, clickText) {
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } })
  await ctx.addInitScript(({ key, value }) => { localStorage.setItem(key, JSON.stringify(value)) }, session)
  const page = await ctx.newPage()
  await page.goto(`${SITE}/payments`, { waitUntil:'networkidle', timeout:30000 })
  await page.waitForTimeout(2500)
  if (tab) { await page.getByText(tab, { exact:true }).click(); await page.waitForTimeout(1200) }
  if (clickText) {
    // Click the text element to expand its parent row
    await page.getByText(clickText, { exact:false }).first().click()
    await page.waitForTimeout(800)
  }
  await page.screenshot({ path: outPath, fullPage: true })
  await ctx.close()
}

console.log('Taking screenshots...')
await Promise.all([
  // Expand Electricidad CFE row
  page_shot(null, '/tmp/svc-exp-elec.png', 'Electricidad — CFE'),
  // Expand report item
  page_shot('Reportes de compras', '/tmp/rpt-exp.png', 'Pintura vinílica galón'),
  // Expand manual
  page_shot('Manuales', '/tmp/man-exp.png', 'Servicio de limpieza fachada'),
])
console.log('Done.')
await browser.close()
