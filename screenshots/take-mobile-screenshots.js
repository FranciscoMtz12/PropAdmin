/**
 * Take fresh screenshots at 390x844 and analyze donut visibility.
 */
const { chromium } = require('playwright');
const https = require('https');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const SUPABASE_REF = 'mremgbneyztpbojwgwcc';
const SUPABASE_HOST = SUPABASE_REF + '.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZW1nYm5leXp0cGJvandnd2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDQ3MzAsImV4cCI6MjA4ODMyMDczMH0.x3B131Y82F5xpnyBFdqrduV_lcktFNqaKjzleEHfGPE';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZW1nYm5leXp0cGJvandnd2NjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc0NDczMCwiZXhwIjoyMDg4MzIwNzMwfQ.-XxZ6dLFR1ZtQg39J-0YDoaJavZk33n_lNiPXQCzH2k';
const ADMIN_EMAIL = 'fco.mtz.c@hotmail.com';
const SS_DIR = path.join(__dirname);

function httpsPost(hostname, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname, path: urlPath, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(new Error('Parse: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getSession(email) {
  const genBody = JSON.stringify({ type: 'magiclink', email });
  const genRes = await httpsPost(SUPABASE_HOST, '/auth/v1/admin/generate_link', genBody, {
    'Authorization': 'Bearer ' + SERVICE_KEY, 'apikey': SERVICE_KEY
  });
  if (!genRes.body.email_otp) throw new Error('No OTP: ' + JSON.stringify(genRes.body).substring(0, 200));
  const verBody = JSON.stringify({ email, token: genRes.body.email_otp, type: 'email' });
  const verRes = await httpsPost(SUPABASE_HOST, '/auth/v1/verify', verBody, { 'apikey': ANON_KEY });
  if (!verRes.body.access_token) throw new Error('No access_token: ' + JSON.stringify(verRes.body).substring(0, 200));
  console.log('Session OK for', email);
  return verRes.body;
}

async function run() {
  console.log('Getting session...');
  const session = await getSession(ADMIN_EMAIL);
  const sessionObj = {
    access_token: session.access_token, refresh_token: session.refresh_token,
    expires_at: session.expires_at, expires_in: session.expires_in,
    token_type: 'bearer', user: session.user
  };
  const storageKey = `sb-${SUPABASE_REF}-auth-token`;

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  await ctx.addInitScript((args) => {
    try { localStorage.setItem(args.key, JSON.stringify(args.session)); } catch(e) {}
  }, { key: storageKey, session: sessionObj });

  const page = await ctx.newPage();
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message.substring(0, 120)));

  // Intercept broken Turbopack chunk
  await page.route('**/_next/static/chunks/*.js', async (route) => {
    const url = route.request().url();
    try {
      const resp = await route.fetch();
      if (resp.status() === 500) {
        console.log('Intercepting broken chunk:', url.split('/').pop());
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: '(()=>{})();' });
      } else {
        await route.fulfill({ response: resp });
      }
    } catch(e) {
      await route.abort();
    }
  });

  await page.route('**/auth/v1/user', route => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
  });

  // Navigate to /buildings directly
  console.log('Navigating to /buildings...');
  await page.goto(`${BASE_URL}/buildings`, { waitUntil: 'networkidle', timeout: 25000 });
  // Check if redirected to login
  let url = page.url();
  if (url.includes('/login')) {
    console.log('Redirected to login, waiting for redirect back...');
    await page.waitForTimeout(4000);
    url = page.url();
  }
  console.log('URL after nav:', url);
  // Wait for splash to finish (2.8s animation) + data load
  await page.waitForTimeout(7000);

  // Take full screenshot of /buildings
  await page.screenshot({ path: path.join(SS_DIR, 'mobile-buildings-before.png'), fullPage: true });
  console.log('Saved mobile-buildings-before.png');

  // Analyze donuts
  const analysis = await page.evaluate(() => {
    // Find all SVGs
    const svgs = Array.from(document.querySelectorAll('svg')).map(svg => {
      const r = svg.getBoundingClientRect();
      const circles = svg.querySelectorAll('circle');
      return {
        w: Math.round(r.width), h: Math.round(r.height),
        top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right),
        circleCount: circles.length,
        visible: r.width > 0 && r.height > 0,
        overflows: r.right > window.innerWidth + 1,
        parentAbsolute: window.getComputedStyle(svg.parentElement).position
      };
    });
    // Find all absolute-positioned elements with width 60-70
    const absEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const cs = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.position === 'absolute' && r.width >= 50 && r.width <= 80 && r.height >= 50;
    }).map(el => {
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), z: cs.zIndex, overflow: cs.overflow };
    });
    // Get building card bounds
    const appCards = Array.from(document.querySelectorAll('.app-card')).map(el => {
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), paddingRight: cs.paddingRight, position: cs.position, overflow: cs.overflow };
    });
    return { svgs, absEls, appCards, vw: window.innerWidth, bsw: document.body.scrollWidth };
  });

  console.log('\n=== SVGs ===');
  analysis.svgs.forEach(s => console.log(`  ${s.w}x${s.h} at(${s.left},${s.top}) right:${s.right} circles:${s.circleCount} visible:${s.visible} overflows:${s.overflows} parentPos:${s.parentAbsolute}`));
  console.log('\n=== Absolute els 50-80px ===');
  analysis.absEls.forEach(e => console.log(`  ${e.w}x${e.h} at(${e.left},${e.top}) right:${e.right} z:${e.z} overflow:${e.overflow}`));
  console.log('\n=== AppCards ===');
  analysis.appCards.slice(0, 5).forEach(c => console.log(`  ${c.w}x${c.h} top:${c.top} paddingRight:${c.paddingRight} pos:${c.position} overflow:${c.overflow}`));
  console.log('\nVP:', analysis.vw, 'BSW:', analysis.bsw);

  // Find a building with units
  const buildingLink = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[style*="cursor: pointer"], [style*="cursor:pointer"]'));
    for (const c of cards) {
      const onclick = c.getAttribute('onclick') || '';
      // Look for buildings/ID links
    }
    // Try to find building IDs from router push
    return null;
  });

  // Try to click first building card to get ID
  const firstCard = await page.$('.app-card');
  if (firstCard) {
    const parentLink = await page.evaluate(el => {
      let node = el;
      while (node && node !== document.body) {
        if (node.onclick || node.getAttribute('data-href')) {
          return { onclick: node.onclick ? 'has onclick' : null };
        }
        node = node.parentElement;
      }
      return null;
    }, firstCard);
    console.log('\nFirst card parent link:', JSON.stringify(parentLink));
  }

  // Get building IDs from the page (Next.js router push calls)
  const buildingIds = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/buildings/"]'));
    return links.map(a => a.href).filter(h => !h.includes('/map'));
  });
  console.log('\nBuilding links found:', buildingIds.slice(0, 3));

  await browser.close();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
