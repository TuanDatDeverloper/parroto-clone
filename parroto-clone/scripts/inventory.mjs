import fs from "node:fs";
import path from "node:path";

const BASE = "https://parroto.app";
const LOCALES = [
  "en", "ar", "de", "el", "es", "id", "ja", "ko", "ms",
  "pt", "ru", "th", "tr", "uk", "vi", "zh-CN", "zh-TW"
];
const DATA_DIR = path.join(process.cwd(), "data");
const SITEMAPS = [
  "sitemap.xml",
  "sitemap-vocabulary.xml",
  "sitemap-community.xml",
  "sitemap-stories.xml"
];
const BLOG_SITEMAP = "blog/sitemap-0.xml";
const APP_LOCALE_ROUTES = new Set([
  "/activation", "/auth/action", "/chat", "/checkout", "/dashboard",
  "/feedbacks", "/login", "/missions", "/my-notes", "/my-vocabulary",
  "/profile", "/review", "/shop", "/exams/ielts/analytics",
  "/exams/ielts/history", "/exams/toeic/analytics", "/exams/toeic/history"
]);

async function getText(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (attempt >= 5) throw err;
    await new Promise((r) => setTimeout(r, 400 * attempt));
    return getText(url, attempt + 1);
  }
}

function uniquePaths(xml) {
  const paths = new Set();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = new URL(match[1]);
    paths.add(url.pathname);
  }
  return [...paths];
}

function localePrefix(locale) {
  return locale === "en" ? "" : `/${locale}`;
}

function withLocale(routePath, locale) {
  if (routePath === "/") return locale === "en" ? "/" : `/${locale}`;
  return `${localePrefix(locale)}${routePath}`;
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const buildManifest = await getText(`${BASE}/_next/static/5yvq-OgoPecVqxR6LR8-B/_buildManifest.js`);
  fs.writeFileSync(path.join(DATA_DIR, "_buildManifest.js"), buildManifest);

  const buildId = buildManifest.match(/buildId|"([A-Za-z0-9_-]{16,})"/)?.[1];
  const manifestPages = [...buildManifest.matchAll(/"(\/[^"]*)"/g)]
    .map((m) => m[1])
    .filter((p) => !p.includes(":") && !p.includes("["))
    .filter((p) => p !== "/_app" && p !== "/_error")
    .filter((p) => !p.startsWith("/sitemap"))
    .filter((p) => p !== "/blog");

  const sitemapRoutes = new Set();
  for (const sitemap of SITEMAPS) {
    const xml = await getText(`${BASE}/${sitemap}`);
    fs.writeFileSync(path.join(DATA_DIR, sitemap), xml);
    for (const p of uniquePaths(xml)) sitemapRoutes.add(p);
  }

  const blogXml = await getText(`${BASE}/${BLOG_SITEMAP}`);
  fs.writeFileSync(path.join(DATA_DIR, "sitemap-blog.xml"), blogXml);
  const blogPaths = uniquePaths(blogXml);

  const routes = [];
  const seen = new Set();
  const push = (url, group) => {
    if (seen.has(url)) return;
    seen.add(url);
    routes.push({ url, group });
  };

  for (const p of manifestPages) {
    const group = APP_LOCALE_ROUTES.has(p) ? "app" : "static";
    for (const locale of LOCALES) push(withLocale(p, locale), group);
  }
  for (const p of sitemapRoutes) {
    for (const locale of LOCALES) push(withLocale(p, locale), "sitemap");
  }
  for (const p of blogPaths) push(p, "blog");

  const inventory = {
    buildId: "5yvq-OgoPecVqxR6LR8-B",
    locales: LOCALES,
    groups: routes.reduce((acc, r) => {
      acc[r.group] = (acc[r.group] ?? 0) + 1;
      return acc;
    }, {}),
    routes
  };
  fs.writeFileSync(path.join(DATA_DIR, "routes.json"), JSON.stringify(inventory, null, 2));
  console.log(JSON.stringify(inventory.groups, null, 2));
  console.log("total routes:", routes.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
