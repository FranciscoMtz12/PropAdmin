// fix-border-radius.js
// Replaces all hardcoded borderRadius numeric values in .tsx files with CSS variables.
// Run from project root: node scripts/fix-border-radius.js

const fs = require("fs");
const path = require("path");

// Mapping: value → CSS variable
function getVar(n) {
  if (n <= 6)  return "var(--border-radius-sm)";
  if (n <= 10) return "var(--border-radius-md)";
  if (n <= 14) return "var(--border-radius-lg)";
  return "var(--border-radius-xl)"; // 15–28
}

// Lines in settings/page.tsx that belong to the theme preview section (do NOT change)
// These represent static mockups of what themes look like — must stay hardcoded.
const SETTINGS_PREVIEW_PATTERNS = [
  /background:\s*bgPage,\s*borderRadius/,
  /background:\s*bgCard,\s*borderRadius/,
  /background:\s*"var\(--bg-page\)",\s*borderRadius:\s*\d/,  // light theme preview container
  /height:\s*7,\s*borderRadius/,      // text bar mockups in preview
  /height:\s*5,\s*borderRadius/,      // text bar mockups in preview
  /height:\s*26,\s*borderRadius:\s*6/, // button preview in dark section
];

function isSettingsPreviewLine(line) {
  return SETTINGS_PREVIEW_PATTERNS.some((re) => re.test(line));
}

function processContent(filePath, content) {
  const isSettings = filePath.replace(/\\/g, "/").includes("app/settings/page.tsx");
  const lines = content.split("\n");
  let totalChanged = 0;

  const processedLines = lines.map((line) => {
    // Skip settings preview lines
    if (isSettings && isSettingsPreviewLine(line)) {
      return line;
    }

    // Replace bare numeric: borderRadius: N (not followed by digit or dot, n in 1..28)
    let newLine = line.replace(/borderRadius:\s*(\d+)(?!\d|\.)/g, (match, numStr) => {
      const n = parseInt(numStr, 10);
      if (n === 0 || n > 28) return match; // skip 0 and pills/circles (>28)
      totalChanged++;
      return `borderRadius: "${getVar(n)}"`;
    });

    // Replace string "Npx": borderRadius: "Npx" (not corner-specific multi-value)
    newLine = newLine.replace(/borderRadius:\s*"(\d+)px"/g, (match, numStr) => {
      const n = parseInt(numStr, 10);
      if (n === 0 || n > 28) return match;
      totalChanged++;
      return `borderRadius: "${getVar(n)}"`;
    });

    return newLine;
  });

  return { result: processedLines.join("\n"), changed: totalChanged };
}

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const item of fs.readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "out", "dist"].includes(item)) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkDir(full, results);
    else if (item.endsWith(".tsx")) results.push(full);
  }
  return results;
}

const BASE = path.resolve(__dirname, "..");
const files = [
  ...walkDir(path.join(BASE, "app")),
  ...walkDir(path.join(BASE, "components")),
];

const report = [];
let grandTotal = 0;

for (const fullPath of files) {
  const raw = fs.readFileSync(fullPath, "utf8");
  const { result, changed } = processContent(fullPath, raw);
  if (changed > 0) {
    fs.writeFileSync(fullPath, result, "utf8");
    const rel = path.relative(BASE, fullPath).replace(/\\/g, "/");
    report.push({ file: rel, changed });
    grandTotal += changed;
    process.stdout.write(`[${changed}] ${rel}\n`);
  }
}

process.stdout.write(`\nTotal: ${grandTotal} replacements in ${report.length} files\n`);
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
