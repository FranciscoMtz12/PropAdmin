import { chromium } from './node_modules/playwright/index.mjs';

const BASE_URL = 'https://prop-admin-teal.vercel.app';
const SB_URL   = 'https://mremgbneyztpbojwgwcc.supabase.co';
const SB_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZW1nYm5leXp0cGJvandnd2NjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc0NDczMCwiZXhwIjoyMDg4MzIwNzMwfQ.-XxZ6dLFR1ZtQg39J-0YDoaJavZk33n_lNiPXQCzH2k';

async function magicLink() {
  const r = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email: 'fco.mtz.c@hotmail.com' }),
  });
  return (await r.json()).action_link;
}

async function main() {
  const link = await magicLink();
  const browser = await chromium.launch({ headless: true });
  const ctx  = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto(link, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.goto(`${BASE_URL}/payments`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.click('text=Manuales');
  await page.waitForTimeout(1200);

  await page.screenshot({ path: '/tmp/pay-verify.png', fullPage: false });
  console.log('Screenshot saved');

  // Check deployed commit hash via meta or by inspecting a known string
  const bodyText = await page.evaluate(() => {
    // Look for the border-radius:12px container
    const divs = Array.from(document.querySelectorAll('div'));
    for (const d of divs) {
      const s = d.getAttribute('style') || '';
      if (s.includes('border-radius: 12px') && s.includes('border-left')) {
        const c = window.getComputedStyle(d);
        return {
          found: true,
          attr: s.slice(0, 350),
          bg: c.backgroundColor,
          border: c.border,
          radius: c.borderRadius,
          borderLeft: c.borderLeftColor + ' ' + c.borderLeftWidth,
        };
      }
    }
    // Also try marginBottom:8px
    for (const d of divs) {
      const s = d.getAttribute('style') || '';
      if (s.includes('margin-bottom: 8px') && s.includes('overflow: hidden')) {
        return { found: true, attr: s.slice(0, 350) };
      }
    }
    return { found: false, totalDivs: divs.length };
  });
  console.log('Card container:', JSON.stringify(bodyText, null, 2));

  const cssVars = await page.evaluate(() => {
    const s = window.getComputedStyle(document.documentElement);
    return {
      '--border-subtle': s.getPropertyValue('--border-subtle').trim(),
      '--bg-card': s.getPropertyValue('--bg-card').trim(),
    };
  });
  console.log('CSS vars:', cssVars);

  await browser.close();
}

main().catch(console.error);
