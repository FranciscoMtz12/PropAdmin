const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'http://localhost:3001';
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

  // ── Step 1: Login ──────────────────────────────────────────────────────────
  console.log('Navigating to login page...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  // Use click + type to trigger React onChange events
  const emailInput = page.locator('input[type="email"]');
  await emailInput.click();
  await emailInput.type(EMAIL, { delay: 50 });
  await page.waitForTimeout(300);

  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.click();
  await passwordInput.type(PASSWORD, { delay: 50 });
  await page.waitForTimeout(300);

  await page.locator('button[type="submit"]').click();

  // Wait for redirect away from login — give generous timeout
  try {
    await page.waitForURL(url => !url.includes('/login'), { timeout: 45000 });
    console.log('Redirected to:', page.url());
  } catch (e) {
    // Check if we actually navigated despite the timeout
    if (!page.url().includes('/login')) {
      console.log('Reached non-login URL:', page.url());
    } else {
      console.log('Still on login after 45s:', page.url());
    }
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  console.log('After login URL:', page.url());

  // ── Step 2: /buildings list ────────────────────────────────────────────────
  console.log('\nNavigating to /buildings...');
  await page.goto(`${BASE_URL}/buildings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const buildingsAnalysis = await page.evaluate(() => {
    const gridElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'grid';
    });
    const gridInfo = gridElements.slice(0, 8).map(el => ({
      tag: el.tagName,
      className: el.className?.toString().substring(0, 100),
      gridTemplateColumns: window.getComputedStyle(el).gridTemplateColumns,
      childCount: el.children.length
    }));

    const cardEls = document.querySelectorAll('.app-card, [class*="card"], [class*="Card"], article');
    const cards = Array.from(cardEls).slice(0, 8).map(c => ({
      tag: c.tagName,
      className: c.className?.toString().substring(0, 80),
      width: Math.round(c.getBoundingClientRect().width),
      // Look for donut/circle svg
      hasDonut: !!c.querySelector('svg, canvas, [class*="donut"], [class*="chart"]'),
      textContent: c.textContent?.trim().substring(0, 60)
    }));

    const buildingLinks = Array.from(document.querySelectorAll('a[href*="/buildings/"]'))
      .map(l => l.href).filter(h => !h.includes('/map')).slice(0, 10);

    // Also try onClick links - look for elements that navigate on click
    const allAnchors = Array.from(document.querySelectorAll('a')).map(a => a.href);

    return {
      gridInfo,
      cards,
      buildingLinks,
      allAnchors: allAnchors.slice(0, 20),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth,
      pageHTML: document.body.innerHTML.substring(0, 500)
    };
  });

  console.log('Buildings list analysis:');
  console.log('  Grids:', JSON.stringify(buildingsAnalysis.gridInfo, null, 2));
  console.log('  Cards:', JSON.stringify(buildingsAnalysis.cards, null, 2));
  console.log('  Building links:', buildingsAnalysis.buildingLinks);
  console.log('  All anchors:', buildingsAnalysis.allAnchors);
  console.log('  hasHorizontalOverflow:', buildingsAnalysis.hasHorizontalOverflow,
    '(', buildingsAnalysis.bodyScrollWidth, 'vs', buildingsAnalysis.viewportWidth, ')');

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'fix-buildings-list.png'), fullPage: true });
  console.log('fix-buildings-list.png saved');

  // ── Step 3: Find a building ID ────────────────────────────────────────────
  const UUID_RE = /\/buildings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  let buildingId = null;

  // Try UUID from discovered links
  for (const href of [...buildingsAnalysis.buildingLinks, ...buildingsAnalysis.allAnchors]) {
    const match = href.match(UUID_RE);
    if (match) { buildingId = match[1]; break; }
  }

  // If no UUID link, click the first .app-card via evaluate (bypasses viewport restriction)
  if (!buildingId) {
    console.log('No UUID link found in anchors. Trying to navigate via card click...');

    // Intercept navigation to capture the building URL
    let navigatedUrl = null;
    page.once('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        navigatedUrl = frame.url();
      }
    });

    // Click first .app-card using JavaScript to avoid viewport issues
    const clicked = await page.evaluate(() => {
      const card = document.querySelector('.app-card');
      if (card) {
        card.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      await page.waitForTimeout(3000);
      const currentUrl = page.url();
      const m = currentUrl.match(UUID_RE);
      if (m) {
        buildingId = m[1];
        console.log('Got building ID from navigation:', buildingId);
        // Go back to buildings list for screenshots
        await page.goto(`${BASE_URL}/buildings`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
      }
    }
  }

  if (!buildingId) {
    // Use a known building with units (639e468e has multiple units)
    buildingId = '639e468e-3fd7-4654-b147-afd78669bb06';
    console.log('Using fallback building ID (building with known units)');
  }
  console.log('Building ID:', buildingId);

  // ── Step 4: Building detail page ──────────────────────────────────────────
  console.log(`\nNavigating to /buildings/${buildingId}...`);
  await page.goto(`${BASE_URL}/buildings/${buildingId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const detailAnalysis = await page.evaluate(() => {
    // Tabs - check for tablist or tab-like containers
    const tabContainers = Array.from(document.querySelectorAll('[role="tablist"], [class*="tab-list"], [class*="tabs"]'))
      .concat(Array.from(document.querySelectorAll('[class*="tab" i]')).filter(el => el.children.length >= 2));
    const seen = new Set();
    const uniqueTabContainers = tabContainers.filter(el => {
      if (seen.has(el)) return false;
      seen.add(el);
      return true;
    });

    const tabInfo = uniqueTabContainers.slice(0, 5).map(container => {
      const style = window.getComputedStyle(container);
      const tabs = Array.from(container.querySelectorAll('[role="tab"], button')).map(b => b.textContent?.trim()).filter(Boolean);
      return {
        tag: container.tagName,
        className: container.className?.toString().substring(0, 120),
        role: container.getAttribute('role'),
        display: style.display,
        flexWrap: style.flexWrap,
        gridTemplateColumns: style.gridTemplateColumns,
        overflowX: style.overflowX,
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
        hasScroll: container.scrollWidth > container.clientWidth,
        tabs
      };
    });

    // Look for metric/stat cards in the page (donut + units count)
    const allDivs = Array.from(document.querySelectorAll('div')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 50 && rect.width < 400 && rect.height > 50;
    });

    // Find grid or flex containers at the top level under main
    const main = document.querySelector('main, [class*="main"], .main-content-wrapper');
    const topLevelWrappers = main ? Array.from(main.children).map(el => {
      const s = window.getComputedStyle(el);
      return {
        tag: el.tagName,
        className: el.className?.toString().substring(0, 80),
        display: s.display,
        gridTemplateColumns: s.gridTemplateColumns,
        flexDirection: s.flexDirection,
        flexWrap: s.flexWrap,
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height)
      };
    }) : [];

    return {
      tabInfo,
      topLevelWrappers,
      pageTitle: document.querySelector('h1, h2')?.textContent?.trim(),
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Building detail analysis:');
  console.log('  Page title:', detailAnalysis.pageTitle);
  console.log('  Tab info:', JSON.stringify(detailAnalysis.tabInfo, null, 2));
  console.log('  Top-level wrappers:', JSON.stringify(detailAnalysis.topLevelWrappers, null, 2));
  console.log('  hasHorizontalOverflow:', detailAnalysis.hasHorizontalOverflow,
    '(', detailAnalysis.bodyScrollWidth, 'vs', detailAnalysis.viewportWidth, ')');

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'fix-building-detail.png'), fullPage: true });
  console.log('fix-building-detail.png saved');

  // ── Step 5: Scroll to tabs and take screenshot ────────────────────────────
  const tabAreaY = await page.evaluate(() => {
    const tabTexts = ['Resumen', 'Assets', 'Documentos', 'Galería'];
    const allButtons = Array.from(document.querySelectorAll('button, [role="tab"]'));
    for (const btn of allButtons) {
      if (tabTexts.some(t => btn.textContent?.trim() === t)) {
        const container = btn.closest('[role="tablist"]') || btn.parentElement;
        const rect = container.getBoundingClientRect();
        return rect.top + window.scrollY;
      }
    }
    // Fallback: look for any tab-like container
    const tabContainer = document.querySelector('[role="tablist"]');
    if (tabContainer) {
      const rect = tabContainer.getBoundingClientRect();
      return rect.top + window.scrollY;
    }
    return null;
  });

  if (tabAreaY !== null) {
    await page.evaluate(y => window.scrollTo(0, Math.max(0, y - 20)), tabAreaY);
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'fix-building-tabs.png') });
    console.log('fix-building-tabs.png saved (tabs area visible)');
  } else {
    console.log('Tab area not found — taking a mid-page screenshot instead');
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'fix-building-tabs.png') });
    console.log('fix-building-tabs.png saved (mid-page fallback)');
  }

  // ── Step 6: Building units page ───────────────────────────────────────────
  console.log(`\nNavigating to /buildings/${buildingId}/units...`);
  await page.goto(`${BASE_URL}/buildings/${buildingId}/units`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const unitsAnalysis = await page.evaluate(() => {
    const cardEls = document.querySelectorAll('.app-card, [class*="unit-card"], [class*="card"], article');
    const cards = Array.from(cardEls).slice(0, 8).map(c => {
      const parentAnchor = c.closest('a');
      return {
        tag: c.tagName,
        className: c.className?.toString().substring(0, 80),
        parentAnchorHref: parentAnchor ? parentAnchor.href : null,
        width: Math.round(c.getBoundingClientRect().width),
        textContent: c.textContent?.trim().substring(0, 60)
      };
    });

    const unitLinks = Array.from(document.querySelectorAll('a[href*="/units/"]')).map(l => ({
      href: l.href,
      text: l.textContent?.trim().substring(0, 30)
    }));

    // Grid analysis
    const grids = Array.from(document.querySelectorAll('*')).filter(el => {
      const s = window.getComputedStyle(el);
      return s.display === 'grid';
    }).slice(0, 5).map(el => {
      const s = window.getComputedStyle(el);
      return {
        className: el.className?.toString().substring(0, 80),
        gridTemplateColumns: s.gridTemplateColumns,
        childCount: el.children.length
      };
    });

    return {
      cards,
      unitLinks: unitLinks.slice(0, 5),
      grids,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth
    };
  });

  console.log('Units analysis:');
  console.log('  Cards:', JSON.stringify(unitsAnalysis.cards, null, 2));
  console.log('  Unit links:', JSON.stringify(unitsAnalysis.unitLinks, null, 2));
  console.log('  Grids:', JSON.stringify(unitsAnalysis.grids, null, 2));
  console.log('  hasHorizontalOverflow:', unitsAnalysis.hasHorizontalOverflow,
    '(', unitsAnalysis.bodyScrollWidth, 'vs', unitsAnalysis.viewportWidth, ')');

  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'fix-building-units.png'), fullPage: true });
  console.log('fix-building-units.png saved');

  // ── Step 7: Unit detail page ───────────────────────────────────────────────
  let unitId = null;
  const UNIT_UUID_RE = /\/units\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

  for (const link of unitsAnalysis.unitLinks) {
    const m = link.href.match(UNIT_UUID_RE);
    if (m) { unitId = m[1]; break; }
  }

  if (!unitId) {
    // Try clicking first card via JS to avoid viewport issues
    console.log('No unit link found in anchors, trying JS click on anchor wrapping a card...');
    const clicked = await page.evaluate(() => {
      // Find an anchor that wraps a card, or a card-like element
      const anchor = document.querySelector('a[href*="/units/"]');
      if (anchor) { anchor.click(); return 'anchor'; }
      // Fallback: find any clickable element with card class
      const card = document.querySelector('div.app-card[onclick], div.app-card');
      if (card) {
        // Dispatch click event
        card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'card';
      }
      return false;
    });
    console.log('Click type:', clicked);
    if (clicked) {
      await page.waitForTimeout(3000);
      const m = page.url().match(UNIT_UUID_RE);
      if (m) unitId = m[1];
    }
  }

  // If still no unit ID, use a known unit from the same building
  if (!unitId) {
    unitId = '80281dec-b1d1-4d03-9950-0cd4e0ad3926';
    console.log('Using fallback unit ID');
  }

  if (unitId) {
    console.log(`\nUnit ID found: ${unitId}`);
    console.log(`Navigating to /buildings/${buildingId}/units/${unitId}...`);
    await page.goto(`${BASE_URL}/buildings/${buildingId}/units/${unitId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const unitDetailAnalysis = await page.evaluate(() => {
      const tabContainers = Array.from(document.querySelectorAll('[role="tablist"], [class*="tab-list"], [class*="tabs"]'))
        .concat(Array.from(document.querySelectorAll('[class*="tab" i]')).filter(el => el.children.length >= 2));
      const seen = new Set();
      const unique = tabContainers.filter(el => { if (seen.has(el)) return false; seen.add(el); return true; });

      const tabInfo = unique.slice(0, 5).map(container => {
        const style = window.getComputedStyle(container);
        const tabs = Array.from(container.querySelectorAll('[role="tab"], button')).map(b => b.textContent?.trim()).filter(Boolean);
        return {
          tag: container.tagName,
          className: container.className?.toString().substring(0, 120),
          role: container.getAttribute('role'),
          display: style.display,
          flexWrap: style.flexWrap,
          gridTemplateColumns: style.gridTemplateColumns,
          overflowX: style.overflowX,
          scrollWidth: container.scrollWidth,
          clientWidth: container.clientWidth,
          hasScroll: container.scrollWidth > container.clientWidth,
          tabs
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

    console.log('Unit detail analysis:');
    console.log('  Page title:', unitDetailAnalysis.pageTitle);
    console.log('  Tab info:', JSON.stringify(unitDetailAnalysis.tabInfo, null, 2));
    console.log('  hasHorizontalOverflow:', unitDetailAnalysis.hasHorizontalOverflow,
      '(', unitDetailAnalysis.bodyScrollWidth, 'vs', unitDetailAnalysis.viewportWidth, ')');

    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'fix-unit-detail.png'), fullPage: true });
    console.log('fix-unit-detail.png saved');
  } else {
    console.log('No unit ID found — skipping unit detail screenshot');
  }

  await browser.close();
  console.log('\nAll done!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
