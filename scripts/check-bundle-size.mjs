#!/usr/bin/env node
// P7.6 performance budget: fails the build if the connect-screen's initial
// JS payload (the entry <script> + everything Vite marks modulepreload in
// dist/index.html — i.e. what a first-time visitor's browser actually
// fetches before the app is interactive) exceeds the budget recorded in
// app-planning/07-phase7-pwa-platform-polish.md. Run after `npm run build`.
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const BUDGET_KB = 160;

const html = readFileSync(path.join(DIST, "index.html"), "utf-8");
const scriptMatches = [...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g)];
const preloadMatches = [...html.matchAll(/<link rel="modulepreload"[^>]+href="\/([^"]+\.js)"/g)];
const files = [...new Set([...scriptMatches, ...preloadMatches].map((m) => m[1]))];

if (files.length === 0) {
  console.error("check-bundle-size: found no entry/modulepreload <script> tags in dist/index.html — did the build output change shape?");
  process.exit(2);
}

let totalGzipBytes = 0;
console.log("Initial connect-screen JS payload:");
for (const file of files) {
  const buf = readFileSync(path.join(DIST, file));
  const gzipSize = gzipSync(buf).length;
  totalGzipBytes += gzipSize;
  console.log(`  ${file}  ${(gzipSize / 1024).toFixed(1)}KB gzip`);
}

const totalKB = totalGzipBytes / 1024;
console.log(`\nTotal: ${totalKB.toFixed(1)}KB gzip (budget: ${BUDGET_KB}KB)`);

if (totalKB > BUDGET_KB) {
  console.error(`\nFAIL: initial JS is ${(totalKB - BUDGET_KB).toFixed(1)}KB over budget.`);
  process.exit(1);
}
console.log("PASS");
