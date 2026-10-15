// Assembles source/ into a single page.
//   dist/index.html       what Vercel serves (plus everything in public/)
//   portal-rewards.html   the same page, for double-click viewing without a server
// No dependencies: `node build.mjs` or `npm run build`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, "source", f), "utf8").replace(/\r\n/g, "\n");

// Swap part3a-wormhole.js for part3a-gate.js to get the earlier "Gate" portal back.
const PORTAL = process.env.PORTAL === "gate" ? "part3a-gate.js" : "part3a-wormhole.js";
const BODY = ["part2-markup.html", "part3a-coin.js", PORTAL, "part3b-page.js"];

// Absolute URL for social previews; Vercel provides the production domain at build time.
const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
const site = host ? (host.startsWith("http") ? host : `https://${host}`).replace(/\/$/, "") : "";
const abs = (p) => (site ? `${site}/${p}` : p);

const TITLE = "Portal Rewards · Where loyalty lives";
const DESC = "A loyalty platform built inside the product. Find the coin, scan it, and the brand you love finally gets to know you back.";

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#07060b">
<meta name="description" content="${DESC}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="website">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:image" content="${abs("og-image.png")}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">${site ? `\n<meta property="og:url" content="${site}/">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESC}">
<meta name="twitter:image" content="${abs("og-image.png")}">
${src("part1-style.html").trimEnd()}
</head>
<body style="margin:0">
`;

const html = head + BODY.map(src).join("") + "\n</body>\n</html>\n";

const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
if (existsSync(join(root, "public"))) cpSync(join(root, "public"), dist, { recursive: true });
writeFileSync(join(dist, "index.html"), html);
writeFileSync(join(root, "portal-rewards.html"), html);
console.log(`Built dist/index.html (${(html.length / 1024).toFixed(1)} KB, portal: ${PORTAL})${site ? ` for ${site}` : ""}`);
