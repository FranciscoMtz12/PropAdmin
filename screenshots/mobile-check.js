const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://prop-admin-teal.vercel.app';
const EMAIL = 'fco.mtz.c12@gmail.com';
const SCREENSHOTS_DIR = path.join(__dirname);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  // ── Step 1: Check if we need to log in ──────────────────────────────────
  console.log('Navigating to /buildings to check session...');
  await page.goto(`${BASE_URL}/buildings`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  if (page.url().includes('/login') || page.url().includes('/auth')) {
    console.log('Login required — filling credentials...');
    // Try to fill email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await emailInput.waitFor({ timeout: 10000 });
    await emailInput.fill(EMAIL);
    await page.waitForTimeout(300);

    // Password — we do NOT change it; we just type in the field.
    // Since no password was provided, we attempt magic-link / OTP flow first.
    // Check if there's a magic-link / OTP button
    const magicBtn = page.locator('button:has-text("magic"), button:has-text("link"), button:has-text("OTP"), button:has-text("email")').first();
    const hasMagic = await magicBtn.count();
    if (hasMagic) {
      console.log('Magic link button found — cannot automate this flow without a password.');
    }

    // Try password field
    const passwordInput = page.locator('input[type="password"]').first();
    const hasPwd = await passwordInput.count();
    if (hasPwd) {
      // Use the known password stored in the previous script (TempPass123! is a placeholder).
      // Since the task says DO NOT change passwords, we just try with what we have.
      // If it fails we'll capture the login page screenshot.
      await passwordInput.fill('TempPass123!');
      await page.waitForTimeout(300);
      const submitBtn = page.locator('button[type="submit"]').first();
      await submitBtn.click();
      try {
        await page.waitForURL(url => !url.includes('/login') && !url.includes('/auth'), { timeout: 15000 });
      } catch {
        console.log('Login may have failed — capturing login page screenshot');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'login-state.png'), fullPage: true });
        await browser.close();
        process.exit(1);
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log(`After login URL: ${page.url()}`);

      // Navigate to /buildings
      await page.goto(`${BASE_URL}/buildings`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
    }
  } else {
    console.log(`Already authenticated — URL: ${page.url()}`);
  }

  // ── Step 2: /buildings screenshot ────────────────────────────────────────
  console.log('\n=== /buildings page ===');
  console.log(`Current URL: ${page.url()}`);

  // Inspect the first building card
  const buildingsAnalysis = await page.evaluate(() => {
    // Building name (likely h2 or h3 inside a card)
    const names = Array.from(document.querySelectorAll('h2, h3, [class*="name"], [class*="title"]')).slice(0, 5).map(el => {
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 40),
        fontWeight: cs.fontWeight,
        fontSize: cs.fontSize,
        className: el.className.toString().substring(0, 60)
      };
    });

    // Address elements (look for p or span with address-like classes or small text)
    const addrs = Array.from(document.querySelectorAll('p, span, address')).filter(el => {
      const cs = window.getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      return fs <= 13;
    }).slice(0, 5).map(el => {
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 60),
        fontSize: cs.fontSize,
        className: el.className.toString().substring(0, 60)
      };
    });

    // Donut / SVG presence
    const svgs = document.querySelectorAll('svg');
    const donuts = Array.from(svgs).map(svg => {
      const rect = svg.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
        top: rect.top,
        left: rect.left
      };
    }).filter(d => d.visible).slice(0, 5);

    // Overflow check
    const cards = Array.from(document.querySelectorAll('[class*="card"], [class*="Card"], article, li')).slice(0, 5).map(el => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: el.className.toString().substring(0, 60),
        width: rect.width,
        overflowsViewport: rect.right > window.innerWidth
      };
    });

    // Building links
    const UUID_RE = /\/buildings\/([0-9a-f-]{36})/i;
    const buildingLinks = Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href)
      .filter(h => UUID_RE.test(h));

    return {
      names,
      addrs,
      donuts,
      cards,
      buildingLinks: [...new Set(buildingLinks)].slice(0, 5),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Building names found:', JSON.stringify(buildingsAnalysis.names, null, 2));
  console.log('Small-text elements (addresses):', JSON.stringify(buildingsAnalysis.addrs, null, 2));
  console.log('SVG donuts visible:', JSON.stringify(buildingsAnalysis.donuts, null, 2));
  console.log('Cards overflow check:', JSON.stringify(buildingsAnalysis.cards, null, 2));
  console.log('Building links:', buildingsAnalysis.buildingLinks);
  console.log('Horizontal overflow:', buildingsAnalysis.hasHorizontalOverflow);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'check-buildings-list.png'), fullPage: true });
  console.log('Saved check-buildings-list.png');

  // ── Step 3: /buildings/[id] screenshot ───────────────────────────────────
  const UUID_RE = /\/buildings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  let buildingId = null;

  for (const href of buildingsAnalysis.buildingLinks) {
    const m = href.match(UUID_RE);
    if (m) { buildingId = m[1]; break; }
  }

  if (!buildingId) {
    // Try to get any href from the page
    const allLinks = await page.$$eval('a[href]', links => links.map(l => l.href));
    for (const href of allLinks) {
      const m = href.match(UUID_RE);
      if (m) { buildingId = m[1]; break; }
    }
  }

  if (!buildingId) {
    buildingId = '5005deec-c5f4-4cac-8df3-b498d5a3c694';
    console.log('Using fallback building ID');
  }

  console.log(`\n=== /buildings/${buildingId} page ===`);
  await page.goto(`${BASE_URL}/buildings/${buildingId}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log(`URL: ${page.url()}`);

  // Inspect action buttons
  const detailAnalysis = await page.evaluate(() => {
    // Find all buttons
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]')).map(btn => {
      const cs = window.getComputedStyle(btn);
      const rect = btn.getBoundingClientRect();
      const icon = btn.querySelector('svg, [class*="icon"], i');
      const text = btn.textContent.trim().substring(0, 30);
      return {
        text,
        tag: btn.tagName,
        className: btn.className.toString().substring(0, 80),
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        borderWidth: cs.borderWidth,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        hasIcon: !!icon,
        visible: rect.width > 0 && rect.height > 0
      };
    }).filter(b => b.visible && b.text.length > 0);

    // Check for Eliminar and Deptos specifically
    const eliminar = buttons.filter(b => b.text.includes('Eliminar'));
    const deptos = buttons.filter(b => b.text.includes('Depto') || b.text.includes('depto'));

    // Grid detection for action buttons
    const grids = Array.from(document.querySelectorAll('*')).filter(el => {
      const cs = window.getComputedStyle(el);
      return cs.display === 'grid';
    }).slice(0, 10).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: el.className.toString().substring(0, 80),
        gridTemplateColumns: cs.gridTemplateColumns,
        gridTemplateRows: cs.gridTemplateRows,
        childCount: el.children.length,
        width: rect.width,
        top: rect.top
      };
    });

    return {
      buttons: buttons.slice(0, 20),
      eliminar,
      deptos,
      grids,
      pageTitle: document.querySelector('h1, h2')?.textContent?.trim(),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Page title:', detailAnalysis.pageTitle);
  console.log('All visible buttons:', JSON.stringify(detailAnalysis.buttons, null, 2));
  console.log('"Eliminar" button:', JSON.stringify(detailAnalysis.eliminar, null, 2));
  console.log('"Deptos" button:', JSON.stringify(detailAnalysis.deptos, null, 2));
  console.log('Grid containers:', JSON.stringify(detailAnalysis.grids, null, 2));
  console.log('Horizontal overflow:', detailAnalysis.hasHorizontalOverflow);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'check-building-detail.png'), fullPage: true });
  console.log('Saved check-building-detail.png');

  // Also capture viewport-only screenshot (no fullPage) to see above-fold
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'check-building-detail-viewport.png'), fullPage: false });
  console.log('Saved check-building-detail-viewport.png');

  await browser.close();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
