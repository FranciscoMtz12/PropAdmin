const { chromium } = require('playwright');
const https = require('https');
const path = require('path');

const BASE_URL = 'https://prop-admin-teal.vercel.app';
const SUPABASE_URL = 'https://mremgbneyztpbojwgwcc.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZW1nYm5leXp0cGJvandnd2NjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc0NDczMCwiZXhwIjoyMDg4MzIwNzMwfQ.-XxZ6dLFR1ZtQg39J-0YDoaJavZk33n_lNiPXQCzH2k';
const USER_EMAIL = 'fco.mtz.c@hotmail.com';
const SCREENSHOTS_DIR = path.join(__dirname);

function getMagicLink() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ type: 'magiclink', email: USER_EMAIL });
    const opts = {
      hostname: 'mremgbneyztpbojwgwcc.supabase.co',
      path: '/auth/v1/admin/generate_link',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (parsed.action_link) resolve(parsed.action_link);
        else reject(new Error('No action_link: ' + data));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  // ── Get magic link ─────────────────────────────────────────────────────
  console.log('Generating magic link...');
  const magicLink = await getMagicLink();
  console.log('Magic link obtained (first 80 chars):', magicLink.substring(0, 80));

  // ── Launch browser ─────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  // ── Step 1: Navigate via magic link to authenticate ────────────────────
  console.log('Navigating magic link...');
  await page.goto(magicLink, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('After magic link URL:', page.url());

  // ── Step 2: Navigate to /buildings ─────────────────────────────────────
  console.log('\n=== /buildings ===');
  await page.goto(`${BASE_URL}/buildings`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());

  // Analyse building cards
  const buildingsAnalysis = await page.evaluate(() => {
    // Card name elements
    const names = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,span')).filter(el => {
      const cs = window.getComputedStyle(el);
      const fw = parseInt(cs.fontWeight);
      return fw >= 600 && el.textContent.trim().length > 2 && el.textContent.trim().length < 60;
    }).slice(0, 8).map(el => {
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 40),
        fontWeight: cs.fontWeight,
        fontSize: cs.fontSize,
        className: el.className.toString().substring(0, 60)
      };
    });

    // Small text (addresses)
    const smallText = Array.from(document.querySelectorAll('p,span,address,small')).filter(el => {
      const cs = window.getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      return fs > 0 && fs <= 13;
    }).slice(0, 8).map(el => {
      const cs = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 60),
        fontSize: cs.fontSize,
        className: el.className.toString().substring(0, 60)
      };
    });

    // Donut / SVG
    const svgs = Array.from(document.querySelectorAll('svg')).map(svg => {
      const rect = svg.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        overflowsViewport: rect.right > window.innerWidth + 2
      };
    }).filter(s => s.width > 0);

    // Overflow check
    const UUID_RE = /\/buildings\/([0-9a-f-]{36})/i;
    const buildingLinks = Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href).filter(h => UUID_RE.test(h));

    return {
      names,
      smallText,
      svgs,
      buildingLinks: [...new Set(buildingLinks)].slice(0, 5),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Bold names:', JSON.stringify(buildingsAnalysis.names, null, 2));
  console.log('Small text (addresses):', JSON.stringify(buildingsAnalysis.smallText, null, 2));
  console.log('SVGs (donuts):', JSON.stringify(buildingsAnalysis.svgs, null, 2));
  console.log('Building links:', buildingsAnalysis.buildingLinks);
  console.log('Horizontal overflow:', buildingsAnalysis.hasHorizontalOverflow, '(body:', buildingsAnalysis.bodyScrollWidth, 'vs vp:', buildingsAnalysis.viewportWidth, ')');

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'check-buildings-list.png'), fullPage: true });
  console.log('Saved check-buildings-list.png');

  // ── Step 3: Extract building ID ─────────────────────────────────────────
  const UUID_RE = /\/buildings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  let buildingId = null;
  for (const href of buildingsAnalysis.buildingLinks) {
    const m = href.match(UUID_RE);
    if (m) { buildingId = m[1]; break; }
  }
  if (!buildingId) {
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
  console.log('\nBuilding ID:', buildingId);

  // ── Step 4: /buildings/[id] ─────────────────────────────────────────────
  console.log(`\n=== /buildings/${buildingId} ===`);
  await page.goto(`${BASE_URL}/buildings/${buildingId}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());

  const detailAnalysis = await page.evaluate(() => {
    // All visible buttons
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]')).map(btn => {
      const cs = window.getComputedStyle(btn);
      const rect = btn.getBoundingClientRect();
      const icon = btn.querySelector('svg, [class*="icon"], i');
      const text = btn.textContent.trim().substring(0, 40);
      return {
        text,
        tag: btn.tagName,
        className: btn.className.toString().substring(0, 100),
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        borderWidth: cs.borderWidth,
        borderStyle: cs.borderStyle,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        hasIcon: !!icon,
        visible: rect.width > 0 && rect.height > 0
      };
    }).filter(b => b.visible && b.text.length > 0);

    // Eliminar specifically
    const eliminar = buttons.filter(b => b.text.toLowerCase().includes('eliminar'));
    // Deptos
    const deptos = buttons.filter(b => b.text.toLowerCase().includes('depto'));
    // Editar
    const editar = buttons.filter(b => b.text.toLowerCase().includes('editar'));

    // Grid containers
    const grids = Array.from(document.querySelectorAll('*')).filter(el => {
      const cs = window.getComputedStyle(el);
      return cs.display === 'grid' && el.children.length >= 2;
    }).slice(0, 10).map(el => {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        className: el.className.toString().substring(0, 100),
        gridTemplateColumns: cs.gridTemplateColumns,
        gridTemplateRows: cs.gridTemplateRows,
        childCount: el.children.length,
        width: Math.round(rect.width),
        top: Math.round(rect.top)
      };
    });

    return {
      buttons,
      eliminar,
      deptos,
      editar,
      grids,
      pageTitle: document.querySelector('h1, h2, h3')?.textContent?.trim(),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Page title:', detailAnalysis.pageTitle);
  console.log('\nAll visible buttons:');
  detailAnalysis.buttons.forEach(b => {
    console.log(` [${b.text}] color:${b.color} bg:${b.backgroundColor} border:${b.borderColor} hasIcon:${b.hasIcon} pos:(${b.left},${b.top}) size:${b.width}x${b.height}`);
  });
  console.log('\n"Eliminar":', JSON.stringify(detailAnalysis.eliminar, null, 2));
  console.log('"Deptos":', JSON.stringify(detailAnalysis.deptos, null, 2));
  console.log('"Editar":', JSON.stringify(detailAnalysis.editar, null, 2));
  console.log('\nGrid containers:', JSON.stringify(detailAnalysis.grids, null, 2));
  console.log('Horizontal overflow:', detailAnalysis.hasHorizontalOverflow);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'check-building-detail.png'), fullPage: true });
  console.log('\nSaved check-building-detail.png');

  // Also viewport-only
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'check-building-detail-viewport.png'), fullPage: false });
  console.log('Saved check-building-detail-viewport.png');

  await browser.close();
  console.log('\nAll done!');
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
