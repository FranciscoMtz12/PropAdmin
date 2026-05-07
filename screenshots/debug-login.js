const { chromium } = require('playwright');
const path = require('path');

const BASE_URL = 'https://prop-admin-teal.vercel.app';
const EMAIL = 'fco.mtz.c@hotmail.com';
const PASSWORD = 'TempPass123!';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Listen to all network requests for login
  const responses = [];
  page.on('response', async (response) => {
    if (response.url().includes('supabase') || response.url().includes('auth')) {
      let body = '';
      try { body = await response.text(); } catch (e) { body = '(could not read)'; }
      responses.push({ url: response.url(), status: response.status(), body: body.substring(0, 500) });
    }
  });

  console.log('Going to login page...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

  // Dump page HTML
  const html = await page.content();
  const formHtml = html.match(/<form[\s\S]*?<\/form>/)?.[0] || 'No form found';
  console.log('Form HTML (first 1000 chars):', formHtml.substring(0, 1000));

  // Check buttons
  const buttons = await page.$$eval('button', btns => btns.map(b => ({ type: b.type, text: b.textContent?.trim(), disabled: b.disabled })));
  console.log('Buttons:', JSON.stringify(buttons));

  // Fill form slowly
  console.log('Filling email...');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.waitForTimeout(500);

  console.log('Filling password...');
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(__dirname, 'debug-before-submit.png'), fullPage: true });

  console.log('Clicking submit...');
  const submitBtn = page.locator('button[type="submit"]');
  const submitBtnCount = await submitBtn.count();
  console.log('Submit button count:', submitBtnCount);

  if (submitBtnCount > 0) {
    await submitBtn.click();
  } else {
    // Try pressing Enter
    await page.keyboard.press('Enter');
  }

  console.log('Waiting after submit...');
  await page.waitForTimeout(5000);

  console.log('Current URL:', page.url());

  await page.screenshot({ path: path.join(__dirname, 'debug-after-submit.png'), fullPage: true });

  // Print network responses
  console.log('\nAuth-related network responses:');
  responses.forEach(r => {
    console.log(`\n${r.status} ${r.url}`);
    console.log(r.body.substring(0, 300));
  });

  // Check for any error text on page
  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('\nPage text (first 500 chars):', pageText.substring(0, 500));

  await browser.close();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
