import { chromium } from "playwright";
import path from "path";

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
const reportPath = path.resolve(process.cwd(), "scripts/audit-reports/mobile-audit-2026-05-25.html");
const url = "file:///" + reportPath.replace(/\\/g, "/");
await page.goto(url);
console.log("Report opened:", url);
// Leave browser open for user to review — exit after 2 minutes
await page.waitForTimeout(120000).catch(() => {});
