const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://prop-admin-teal.vercel.app';
const EMAIL = 'fco.mtz.c@hotmail.com';
const PASSWORD = 'TempPass123!';
const SCREENSHOTS_DIR = path.join(__dirname);

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  // Step 1: Login
  console.log('Navigating to login page...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  await page.locator('input[type="email"]').fill(EMAIL);
  await page.waitForTimeout(300);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.waitForTimeout(300);
  await page.locator('button[type="submit"]').click();

  // Wait for navigation away from login
  await page.waitForURL(/\/(?!login)/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log(`Logged in! Current URL: ${page.url()}`);

  // Step 2: Navigate to /buildings
  console.log('\nNavigating to /buildings...');
  await page.goto(`${BASE_URL}/buildings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const buildingsAnalysis = await page.evaluate(() => {
    // Find grid container
    const gridElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'grid';
    });

    const gridInfo = gridElements.slice(0, 5).map(el => ({
      tag: el.tagName,
      className: el.className.toString().substring(0, 100),
      gridTemplateColumns: window.getComputedStyle(el).gridTemplateColumns,
      childCount: el.children.length
    }));

    // Find card-like elements
    const cardEls = document.querySelectorAll('[class*="card"], [class*="Card"], article');
    const cards = Array.from(cardEls).slice(0, 5).map(c => ({
      tag: c.tagName,
      className: c.className.toString().substring(0, 80),
      width: c.getBoundingClientRect().width
    }));

    // Check for building links
    const buildingLinks = Array.from(document.querySelectorAll('a[href*="/buildings/"]')).map(l => l.href);

    return {
      gridInfo,
      cards,
      buildingLinks: buildingLinks.slice(0, 5),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Buildings analysis:');
  console.log('  Grid info:', JSON.stringify(buildingsAnalysis.gridInfo, null, 2));
  console.log('  Cards:', JSON.stringify(buildingsAnalysis.cards, null, 2));
  console.log('  Building links:', buildingsAnalysis.buildingLinks);
  console.log('  Has horizontal overflow:', buildingsAnalysis.hasHorizontalOverflow);
  console.log('  Body scroll width vs viewport:', buildingsAnalysis.bodyScrollWidth, 'vs', buildingsAnalysis.viewportWidth);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'buildings-list.png'), fullPage: true });
  console.log('buildings-list.png saved');

  // Step 3: Get building ID by clicking a building card
  // UUID pattern: 8-4-4-4-12 hex chars
  const UUID_RE = /\/buildings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  let buildingId = null;

  // Check links with UUID pattern
  const allLinks = await page.$$eval('a[href]', links =>
    links.map(l => l.href)
  );
  for (const href of allLinks) {
    const match = href.match(UUID_RE);
    if (match) { buildingId = match[1]; break; }
  }

  if (!buildingId) {
    // Click on the first building card (div.app-card) and detect UUID in resulting URL
    console.log('No UUID link found, trying to click a card...');
    const cards = await page.$$('div.app-card');
    if (cards.length > 0) {
      await cards[0].click();
      await page.waitForTimeout(3000);
      const urlMatch = page.url().match(UUID_RE);
      if (urlMatch) buildingId = urlMatch[1];
    }
  }

  if (!buildingId) {
    // Fallback: use known building ID from API
    buildingId = '5005deec-c5f4-4cac-8df3-b498d5a3c694';
    console.log('Using fallback building ID (Sevilla 111)');
  }

  console.log(`\nBuilding ID: ${buildingId}`);

  // Step 4: Navigate to building detail
  console.log(`Navigating to /buildings/${buildingId}...`);
  await page.goto(`${BASE_URL}/buildings/${buildingId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const detailAnalysis = await page.evaluate(() => {
    const tabContainers = Array.from(document.querySelectorAll('[role="tablist"], [class*="tab" i]')).filter(el =>
      el.children.length > 1
    );

    const tabInfo = tabContainers.slice(0, 3).map(container => {
      const style = window.getComputedStyle(container);
      const overflowX = style.overflowX;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      return {
        tag: container.tagName,
        className: container.className.toString().substring(0, 80),
        role: container.getAttribute('role'),
        overflowX,
        scrollWidth,
        clientWidth,
        hasScroll: scrollWidth > clientWidth,
        tabCount: container.querySelectorAll('[role="tab"], button').length
      };
    });

    return {
      tabInfo,
      pageTitle: document.querySelector('h1, h2')?.textContent?.trim(),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Building detail analysis:');
  console.log('  Tab info:', JSON.stringify(detailAnalysis.tabInfo, null, 2));
  console.log('  Page title:', detailAnalysis.pageTitle);
  console.log('  Has horizontal overflow:', detailAnalysis.hasHorizontalOverflow);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'buildings-detail.png'), fullPage: true });
  console.log('buildings-detail.png saved');

  // Step 5: Navigate to /buildings/[id]/units
  console.log(`\nNavigating to /buildings/${buildingId}/units...`);
  await page.goto(`${BASE_URL}/buildings/${buildingId}/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const unitsAnalysis = await page.evaluate(() => {
    // Find unit cards
    const cardEls = document.querySelectorAll('[class*="card"], [class*="Card"], article');
    const cards = Array.from(cardEls).slice(0, 5).map(c => {
      // Check if card itself is wrapped in anchor or has click handler
      const parentAnchor = c.closest('a');
      const hasHref = parentAnchor ? parentAnchor.href : null;
      const hasOnClick = c.onclick != null;
      const style = window.getComputedStyle(c);
      const cursor = style.cursor;
      return {
        tag: c.tagName,
        className: c.className.toString().substring(0, 80),
        parentAnchorHref: hasHref,
        hasOnClick,
        cursor,
        width: c.getBoundingClientRect().width
      };
    });

    // Count "Ver" buttons
    const verButtons = Array.from(document.querySelectorAll('button, a')).filter(b =>
      b.textContent?.trim() === 'Ver' || b.textContent?.trim() === 'Ver detalles'
    );

    // Check unit links
    const unitLinks = Array.from(document.querySelectorAll('a[href*="/units/"]')).map(l => ({
      href: l.href,
      tag: l.tagName,
      text: l.textContent?.trim().substring(0, 30)
    }));

    return {
      cards,
      verButtonCount: verButtons.length,
      unitLinks: unitLinks.slice(0, 5),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Units analysis:');
  console.log('  Cards:', JSON.stringify(unitsAnalysis.cards, null, 2));
  console.log('  "Ver" button count:', unitsAnalysis.verButtonCount);
  console.log('  Unit links:', JSON.stringify(unitsAnalysis.unitLinks, null, 2));
  console.log('  Has horizontal overflow:', unitsAnalysis.hasHorizontalOverflow);

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'buildings-units.png'), fullPage: true });
  console.log('buildings-units.png saved');

  await browser.close();
  console.log('\nAll screenshots saved successfully!');
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
