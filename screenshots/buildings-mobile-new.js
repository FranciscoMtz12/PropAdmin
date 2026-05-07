/**
 * Buildings mobile screenshot script.
 *
 * Auth strategy:
 * 1. Get Supabase session via admin OTP generate + verify for fco.mtz.c@hotmail.com (superadmin)
 * 2. Inject session into localStorage via addInitScript (runs before page scripts)
 * 3. Load /login → session found → RouteGuard redirects to /dashboard
 * 4. Once on /dashboard, open mobile sidebar (hamburger) then click "Edificios" link
 *    → Next.js SPA navigation to /buildings (avoids full page reload issues)
 * 5. Intercept broken Turbopack chunk 1003af7792d769ee.js with valid empty stub
 * 6. Take screenshots and analyse
 */
const { chromium } = require('playwright');
const https = require('https');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
const SUPABASE_REF = 'mremgbneyztpbojwgwcc';
const SUPABASE_HOST = SUPABASE_REF + '.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZW1nYm5leXp0cGJvandnd2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3NDQ3MzAsImV4cCI6MjA4ODMyMDczMH0.x3B131Y82F5xpnyBFdqrduV_lcktFNqaKjzleEHfGPE';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZW1nYm5leXp0cGJvandnd2NjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc0NDczMCwiZXhwIjoyMDg4MzIwNzMwfQ.-XxZ6dLFR1ZtQg39J-0YDoaJavZk33n_lNiPXQCzH2k';
const ADMIN_EMAIL = 'fco.mtz.c@hotmail.com'; // superadmin user that exists in app_users
const SCREENSHOTS_DIR = path.join(__dirname);

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
  // Generate OTP
  const genBody = JSON.stringify({ type: 'magiclink', email });
  const genRes = await httpsPost(SUPABASE_HOST, '/auth/v1/admin/generate_link', genBody, {
    'Authorization': 'Bearer ' + SERVICE_KEY, 'apikey': SERVICE_KEY
  });
  if (!genRes.body.email_otp) throw new Error('No OTP: ' + JSON.stringify(genRes.body).substring(0, 200));

  // Exchange OTP for session
  const verBody = JSON.stringify({ email, token: genRes.body.email_otp, type: 'email' });
  const verRes = await httpsPost(SUPABASE_HOST, '/auth/v1/verify', verBody, { 'apikey': ANON_KEY });
  if (!verRes.body.access_token) throw new Error('No access_token: ' + JSON.stringify(verRes.body).substring(0, 200));

  console.log('Session OK for', email, '| expires_in:', verRes.body.expires_in, '| user_id:', verRes.body.user?.id?.substring(0, 8));
  return verRes.body;
}

async function run() {
  // ── 1. Get session ─────────────────────────────────────────────────────────
  console.log('Getting session...');
  const session = await getSession(ADMIN_EMAIL);

  const sessionObj = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: 'bearer',
    user: session.user
  };
  const storageKey = `sb-${SUPABASE_REF}-auth-token`;

  // ── 2. Launch browser and inject session ───────────────────────────────────
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  // Pre-inject session before ANY page script (addInitScript runs before JS)
  await ctx.addInitScript((args) => {
    try {
      localStorage.setItem(args.key, JSON.stringify(args.session));
      // Also ensure this runs during every navigation
    } catch (e) {
      console.warn('localStorage set failed:', e);
    }
  }, { key: storageKey, session: sessionObj });

  const page = await ctx.newPage();

  // ── Collect console messages and errors for debugging ──────────────────────
  const consoleMsgs = [];
  const pageErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMsgs.push({ type: msg.type(), text: text.substring(0, 200) });
  });
  page.on('pageerror', err => {
    pageErrors.push(err.message.substring(0, 200));
  });

  // ── Intercept broken Turbopack chunk ──────────────────────────────────────
  // 1003af7792d769ee.js returns HTTP 500, which crashes the buildings page.
  // We intercept it and return a valid no-op Turbopack chunk.
  await page.route('**/_next/static/chunks/1003af7792d769ee.js', route => {
    console.log('Intercepting broken chunk: 1003af7792d769ee.js');
    // Return a valid TURBOPACK chunk that defines no module exports
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,99999,(e,t,r)=>{"use strict";}]);'
    });
  });

  // Also intercept Supabase auth/user endpoint to short-circuit token validation
  // and return the user directly from our session object
  const userObj = session.user;
  await page.route('**/auth/v1/user', route => {
    console.log('Intercepting /auth/v1/user -> returning session user');
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(userObj)
    });
  });

  // ── 3. Load /login → should redirect to /dashboard once session resolves ───
  console.log('\nNavigating to /login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 20000 });

  // Wait for RouteGuard to redirect
  console.log('Waiting for redirect from /login...');
  let redirected = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const url = page.url();
    if (!url.includes('/login')) {
      console.log('Redirected to:', url);
      redirected = true;
      break;
    }
  }

  if (!redirected) {
    console.log('No redirect after 15s. URL:', page.url());
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('Body:', bodyText);

    // Print recent console messages
    console.log('\nRecent console messages:');
    consoleMsgs.slice(-10).forEach(m => console.log(`  [${m.type}] ${m.text}`));
    console.log('\nPage errors:', pageErrors.slice(-5));

    // Try: check if localStorage has session
    const lsCheck = await page.evaluate((key) => {
      const val = localStorage.getItem(key);
      return { hasKey: !!val, length: val ? val.length : 0 };
    }, storageKey);
    console.log('localStorage session check:', lsCheck);

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'debug-login-stuck.png'), fullPage: true });
    console.log('Saved debug-login-stuck.png');

    // Fallback: try to navigate directly
    console.log('Fallback: going directly to /buildings via goto...');
    await page.goto(`${BASE_URL}/buildings`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);
  } else {
    // Wait for dashboard to fully render
    await page.waitForTimeout(3000);
    console.log('Dashboard loaded. URL:', page.url());

    // ── 4a. Debug: check what's on dashboard ──────────────────────────────
    const lsSession = await page.evaluate((key) => {
      try { return !!localStorage.getItem(key); } catch(e) { return false; }
    }, storageKey);
    console.log('localStorage has session on dashboard:', lsSession);

    // ── 4b. Open mobile sidebar and click Edificios link ──────────────────
    console.log('\nOpening mobile sidebar...');

    // Click the hamburger button
    const hamburger = await page.$('.sidebar-hamburger, button[aria-label="Menú"]');
    if (hamburger) {
      console.log('Found hamburger, clicking...');
      await hamburger.click({ force: true });
      await page.waitForTimeout(1000);
    } else {
      console.log('No hamburger found, trying by aria-label...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const h = btns.find(b => b.getAttribute('aria-label') === 'Menú' || b.className.includes('hamburger'));
        if (h) { h.click(); console.log('Hamburger clicked via evaluate'); }
        else { console.log('Hamburger not found via evaluate'); }
      });
      await page.waitForTimeout(1000);
    }

    // Now look for the Edificios link
    console.log('Looking for Edificios link...');
    const edificiosLink = await page.$('a[href="/buildings"]');
    if (edificiosLink) {
      const box = await edificiosLink.boundingBox();
      console.log('Edificios link found, bbox:', JSON.stringify(box));

      // Click with force to bypass visibility check
      await edificiosLink.click({ force: true });
      console.log('Edificios link clicked');
    } else {
      console.log('No a[href="/buildings"] found. Trying dispatchEvent...');
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const el = links.find(a => a.href.includes('/buildings'));
        if (el) {
          console.log('Found buildings link via evaluate:', el.href);
          el.click();
        } else {
          console.log('No buildings link at all!');
        }
      });
    }

    // Wait for navigation
    console.log('Waiting for /buildings navigation...');
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      const url = page.url();
      if (url.includes('/buildings')) {
        console.log('On /buildings! URL:', url);
        break;
      }
      if (i === 19) console.log('Did not navigate to /buildings. URL:', page.url());
    }
  }

  // Wait for buildings content to load
  await page.waitForTimeout(3000);
  console.log('Final URL:', page.url());

  // ── 5. Diagnostic: what's on screen ────────────────────────────────────────
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 600));
  console.log('\nBody text:', bodyText);

  console.log('\nRecent console messages (last 15):');
  consoleMsgs.slice(-15).forEach(m => console.log(`  [${m.type}] ${m.text}`));
  if (pageErrors.length) console.log('Page errors:', pageErrors.slice(-5));

  // ── 6. Take full-page screenshot ───────────────────────────────────────────
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'buildings-mobile-new.png'),
    fullPage: true
  });
  console.log('\nSaved buildings-mobile-new.png');

  // ── 7. Analyse building cards ──────────────────────────────────────────────
  console.log('\n=== Analysis ===');
  const analysis = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,p,span')).filter(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return parseInt(cs.fontWeight) >= 600 && rect.width > 0 && rect.height > 0
        && el.textContent.trim().length > 2 && el.children.length === 0;
    }).slice(0, 30).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        text: el.textContent.trim().substring(0, 60),
        fontSize: cs.fontSize, fontWeight: cs.fontWeight,
        textOverflow: cs.textOverflow, whiteSpace: cs.whiteSpace,
        width: Math.round(rect.width), top: Math.round(rect.top)
      };
    });

    const smallText = Array.from(document.querySelectorAll('*')).filter(el => {
      const cs = window.getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      const rect = el.getBoundingClientRect();
      return fs > 0 && fs <= 13 && rect.width > 0 && rect.height > 0
        && el.textContent.trim().length > 3 && el.children.length === 0;
    }).slice(0, 20).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return { text: el.textContent.trim().substring(0, 60), fontSize: cs.fontSize, top: Math.round(rect.top) };
    });

    const svgs = Array.from(document.querySelectorAll('svg')).filter(svg => {
      const rect = svg.getBoundingClientRect();
      return rect.width > 20 && rect.height > 20;
    }).map(svg => {
      const rect = svg.getBoundingClientRect();
      return {
        width: Math.round(rect.width), height: Math.round(rect.height),
        top: Math.round(rect.top), left: Math.round(rect.left), right: Math.round(rect.right),
        circleCount: svg.querySelectorAll('circle, path').length,
        overflowsVP: rect.right > window.innerWidth + 2
      };
    });

    const grids = Array.from(document.querySelectorAll('*')).filter(el => {
      const cs = window.getComputedStyle(el);
      return cs.display === 'grid' && el.children.length >= 1;
    }).slice(0, 15).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        className: el.className.toString().substring(0, 60),
        gridTemplateColumns: cs.gridTemplateColumns,
        childCount: el.children.length, width: Math.round(rect.width), top: Math.round(rect.top)
      };
    });

    const allButtons = Array.from(document.querySelectorAll('button')).filter(btn => {
      const rect = btn.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).map(btn => {
      const rect = btn.getBoundingClientRect();
      return {
        text: btn.textContent.trim().substring(0, 30),
        ariaLabel: btn.getAttribute('aria-label') || '',
        hasSvg: !!btn.querySelector('svg'),
        width: Math.round(rect.width), height: Math.round(rect.height),
        top: Math.round(rect.top), left: Math.round(rect.left)
      };
    });

    return { names, smallText, svgs, grids, allButtons, vw: window.innerWidth, bsw: document.body.scrollWidth };
  });

  console.log('\n--- Names (bold) ---');
  analysis.names.forEach(n => console.log(`  [${n.top}px] "${n.text}" fw:${n.fontWeight} fs:${n.fontSize} w:${n.width}`));
  console.log('\n--- Small text (≤13px) ---');
  analysis.smallText.forEach(s => console.log(`  [${s.top}px] "${s.text}" fs:${s.fontSize}`));
  console.log('\n--- SVGs ---');
  analysis.svgs.forEach(s => console.log(`  ${s.width}x${s.height} at(${s.left},${s.top}) right:${s.right} circles:${s.circleCount} overflows:${s.overflowsVP}`));
  console.log('\n--- Grids ---');
  analysis.grids.forEach(g => console.log(`  [${g.top}px] "${g.className.substring(0,50)}" cols:"${g.gridTemplateColumns}" children:${g.childCount} w:${g.width}`));
  console.log('\n--- Buttons ---');
  analysis.allButtons.forEach(b => console.log(`  [${b.top}px] "${b.text}" aria:"${b.ariaLabel}" hasSvg:${b.hasSvg} pos:(${b.left},${b.top}) size:${b.width}x${b.height}`));
  console.log('\nVP:', analysis.vw, 'BSW:', analysis.bsw);

  // ── 8. Click "..." MoreHorizontal button ───────────────────────────────────
  console.log('\n=== Click MoreHorizontal ===');
  const allBtns = await page.$$('button');
  let moreBtnClicked = false;

  // First try: empty-text small SVG buttons below header area (y > 150)
  for (const btn of allBtns) {
    const rect = await btn.boundingBox();
    if (!rect) continue;
    if (!await btn.$('svg')) continue;
    const text = (await btn.evaluate(el => el.textContent.trim()));
    const aria = await btn.getAttribute('aria-label') || '';
    if (rect.width <= 44 && rect.height <= 44 && rect.y > 150 && text === '') {
      console.log(`Clicking icon-only button at (${Math.round(rect.x)},${Math.round(rect.y)}) aria:"${aria}" size:${Math.round(rect.width)}x${Math.round(rect.height)}`);
      await btn.click({ force: true });
      moreBtnClicked = true;
      break;
    }
  }

  if (!moreBtnClicked) {
    // Fallback: any small button below 150px
    for (const btn of allBtns) {
      const rect = await btn.boundingBox();
      if (!rect || rect.width > 50 || rect.height > 50 || rect.y <= 100) continue;
      const t = await btn.evaluate(el => el.textContent.trim());
      const a = await btn.getAttribute('aria-label') || '';
      console.log(`Fallback clicking: (${Math.round(rect.x)},${Math.round(rect.y)}) text:"${t}" aria:"${a}" size:${Math.round(rect.width)}x${Math.round(rect.height)}`);
      await btn.click({ force: true });
      moreBtnClicked = true;
      break;
    }
  }

  if (!moreBtnClicked) {
    console.log('No suitable "..." button found among', allBtns.length, 'buttons');
    // List all buttons for debugging
    for (const btn of allBtns) {
      const rect = await btn.boundingBox();
      if (!rect) continue;
      const t = await btn.evaluate(el => el.textContent.trim().substring(0, 20));
      const a = await btn.getAttribute('aria-label') || '';
      console.log(`  btn: "${t}" aria:"${a}" pos:(${Math.round(rect.x)},${Math.round(rect.y)}) size:${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
  }

  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'buildings-dropdown.png'),
    fullPage: false
  });
  console.log('\nSaved buildings-dropdown.png');

  // Analyse dropdown
  const drop = await page.evaluate(() => {
    const radix = Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]')).map(el => {
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return { text: el.textContent.trim().substring(0, 150), zIndex: cs.zIndex, top: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) };
    });
    const menus = Array.from(document.querySelectorAll('[role="menu"]')).map(el => {
      const rect = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      return { text: el.textContent.trim().substring(0, 150), zIndex: cs.zIndex, position: cs.position, top: Math.round(rect.top) };
    });
    const eliminar = Array.from(document.querySelectorAll('*')).filter(el => {
      const t = el.textContent.trim().toLowerCase();
      const rect = el.getBoundingClientRect();
      return t.includes('eliminar') && t.length < 40 && rect.width > 0 && el.children.length === 0;
    }).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return { tag: el.tagName, text: el.textContent.trim(), color: cs.color, zIndex: cs.zIndex, top: Math.round(rect.top) };
    });
    // All visible absolutely positioned elements (dropdown candidates)
    const absEls = Array.from(document.querySelectorAll('*')).filter(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (cs.position === 'absolute' || cs.position === 'fixed') && rect.width > 50 && rect.height > 30 && rect.width < 400;
    }).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName, text: el.textContent.trim().substring(0, 80),
        position: cs.position, zIndex: cs.zIndex,
        top: Math.round(rect.top), left: Math.round(rect.left),
        w: Math.round(rect.width), h: Math.round(rect.height)
      };
    }).slice(0, 10);
    return { radix, menus, eliminar, absEls };
  });

  console.log('\n--- Radix popper ---');
  drop.radix.forEach(r => console.log(`  z:${r.zIndex} ${r.w}x${r.h} top:${r.top} text:"${r.text.substring(0,80)}"`));
  console.log('--- role=menu ---');
  drop.menus.forEach(m => console.log(`  z:${m.zIndex} pos:${m.position} top:${m.top} text:"${m.text.substring(0,80)}"`));
  console.log('--- Eliminar ---');
  drop.eliminar.forEach(e => console.log(`  ${e.tag} "${e.text}" color:${e.color} z:${e.zIndex} top:${e.top}`));
  console.log('--- Absolute/fixed positioned elements (dropdown candidates) ---');
  drop.absEls.forEach(e => console.log(`  ${e.tag} pos:${e.position} z:${e.zIndex} ${e.w}x${e.h} at(${e.left},${e.top}) text:"${e.text.substring(0,60)}"`));

  await browser.close();
  console.log('\n=== Done ===');
}

run().catch(err => {
  console.error('Fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
