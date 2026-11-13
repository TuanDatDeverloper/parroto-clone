import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
const BASE = "https://parroto.app";
const BUILD_ID = "5yvq-OgoPecVqxR6LR8-B";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36";
const ASSET_HOSTS = new Map([
  ["assets.parroto.app", "/assets"],
  ["podcast.parroto.app", "/podcast"]
]);
const TEXT_TYPES = /^(text\/|application\/(json|javascript|xml|xhtml\+xml|rss\+xml)|image\/svg)/i;
const FILE_EXT = /\.(webp|png|jpe?g|gif|svg|ico|css|js|mjs|json|woff2?|ttf|otf|eot|mp3|m4a|mp4|webm|pdf|txt|xml|webmanifest)$/i;
const PAGE_EXT = new Set([".html", ".htm", ".json", ".xml", ".txt"]);
const SKIP_SCHEMES = /^(data|mailto|tel|javascript|blob|about|chrome)/i;

const argv = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  })
);

const groups = new Set((argv.groups ?? "static,app").split(",").filter(Boolean));
const concurrency = Number(argv.concurrency ?? 12);
const force = argv.force === "true";
const maxAssetBytes = Number(argv.maxAssetBytes ?? 48 * 1024 * 1024);

const stats = {
  pages: { ok: 0, fail: 0, bytes: 0 },
  assets: { ok: 0, fail: 0, bytes: 0 },
  skipped: 0,
  failures: []
};
const downloaded = new Set();
const assetQueue = new Set();
const dataWritten = new Set();

function localPathFor(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0].split("#")[0]);
  const clean = decoded.replace(/^\/+/, "");
  if (decoded.endsWith("/")) return path.join(PUBLIC, clean, "index.html");
  const base = clean.split("/").pop() ?? "";
  if (!base.includes(".")) return path.join(PUBLIC, clean + ".html");
  return path.join(PUBLIC, clean);
}

function isTextType(contentType) {
  return TEXT_TYPES.test(contentType ?? "");
}

async function fetchBuffer(url, allowNotFoundBody = false) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" }, redirect: "follow" });
      if ((res.status === 404 || res.status === 410) && allowNotFoundBody) {
        const buffer = Buffer.from(await res.arrayBuffer());
        return { status: res.status, contentType: res.headers.get("content-type") ?? "", buffer, finalUrl: res.url };
      }
      if (res.status === 404 || res.status === 410) return { status: res.status, notFound: true };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      return { status: res.status, contentType: res.headers.get("content-type") ?? "", buffer, finalUrl: res.url };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 300 * attempt * attempt));
    }
  }
  throw lastError;
}

async function saveFile(target, buffer) {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, buffer);
}

async function downloadPage(routeUrl) {
  const url = `${BASE}${routeUrl}`;
  const target = localPathFor(routeUrl);
  if (!force && fs.existsSync(target)) {
    const size = fs.statSync(target).size;
    if (size > 0) {
      stats.pages.ok += 1;
      stats.pages.bytes += size;
      downloaded.add(routeUrl);
      await emitNextData(routeUrl, target);
      return;
    }
  }
  try {
    const result = await fetchBuffer(url);
    if (result.notFound) {
      stats.pages.fail += 1;
      stats.failures.push({ url, reason: "not-found" });
      return;
    }
    await saveFile(target, result.buffer);
    stats.pages.ok += 1;
    stats.pages.bytes += result.buffer.length;
    downloaded.add(routeUrl);
    if (/html/i.test(result.contentType)) await emitNextData(routeUrl, target);
  } catch (err) {
    stats.pages.fail += 1;
    stats.failures.push({ url, reason: String(err?.message ?? err) });
  } finally {
    reportProgress();
  }
}

async function emitNextData(routeUrl, htmlPath) {
  let html;
  try {
    html = await fsp.readFile(htmlPath, "utf8");
  } catch {
    return;
  }
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return;
  let parsed;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    return;
  }
  const locale = parsed.locale ?? "en";
  const segments = routeUrl.replace(/^\/+/, "").split("/");
  const hasLocalePrefix = segments[0] === locale && locale !== "en";
  const routeSegments = hasLocalePrefix ? segments.slice(1) : segments;
  const routeKey = routeSegments.join("/");
  const dataPath = routeKey
    ? path.join(PUBLIC, "_next", "data", BUILD_ID, locale, routeKey + ".json")
    : path.join(PUBLIC, "_next", "data", BUILD_ID, locale + ".json");
  if (dataWritten.has(dataPath)) return;
  dataWritten.add(dataPath);
  const payload = {
    page: parsed.page,
    buildId: parsed.buildId ?? BUILD_ID,
    query: parsed.query ?? {},
    locale: parsed.locale,
    locales: parsed.locales,
    defaultLocale: parsed.defaultLocale,
    pageProps: parsed.pageProps ?? {}
  };
  await fsp.mkdir(path.dirname(dataPath), { recursive: true });
  await fsp.writeFile(dataPath, JSON.stringify(payload));
}

function reportProgress() {
  const total = stats.pages.ok + stats.pages.fail;
  if (total % 50 === 0) {
    console.log(`pages ok=${stats.pages.ok} fail=${stats.pages.fail} ${(stats.pages.bytes / 1048576).toFixed(1)}MB assets=${stats.assets.ok} pendingAssets=${assetQueue.size}`);
  }
}

function normalizeAsset(rawUrl, pageUrl) {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim().replace(/&amp;/g, "&");
  if (SKIP_SCHEMES.test(trimmed)) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${BASE}${trimmed}`;
  if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, `${BASE}${pageUrl}`).href;
  } catch {
    return null;
  }
}

function assetPathFor(url) {
  const parsed = new URL(url);
  const host = parsed.hostname;
  if (host === "parroto.app" || host === "www.parroto.app") return parsed.pathname;
  const prefix = ASSET_HOSTS.get(host);
  if (prefix) return `${prefix}${parsed.pathname}`;
  return null;
}

function collectFromText(text, sourceUrl) {
  const found = new Set();
  const patterns = [
    /["'(](\/_next\/static\/[^"')\s]+)/g,
    /["'(](\/_next\/data\/[^"')\s]+)/g,
    /["'(](\/_astro\/[^"')\s]+)/g,
    /["'(]((?:\/)[^"'()\s]*?\.(?:webp|png|jpe?g|gif|svg|ico|css|js|json|woff2?|ttf|otf|mp3|m4a|mp4|webm|pdf|xml|webmanifest))/gi,
    /(https:\/\/assets\.parroto\.app\/[^"')\s]+)/g,
    /(https:\/\/podcast\.parroto\.app\/[^"')\s]+)/g,
    /(https:\/\/parroto\.app\/[^"')\s]*?\.(?:webp|png|jpe?g|gif|svg|ico|css|js|json|woff2?|ttf|otf|mp3|m4a|mp4|webm|pdf|xml|webmanifest))/gi
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const candidate = match[1];
      const normalized = normalizeAsset(candidate, sourceUrl);
      if (!normalized) continue;
      const assetPath = assetPathFor(normalized);
      if (!assetPath) continue;
      if (PAGE_EXT.has(path.extname(assetPath).toLowerCase()) && assetPath.startsWith("/assets/") === false) {
        continue;
      }
      if (downloaded.has(assetPath) || assetQueue.has(assetPath)) continue;
      found.add(assetPath);
    }
  }
  for (const cssUrl of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const resolved = normalizeAsset(cssUrl[1], sourceUrl);
    if (!resolved) continue;
    const assetPath = assetPathFor(resolved);
    if (!assetPath) continue;
    if (downloaded.has(assetPath) || assetQueue.has(assetPath)) continue;
    found.add(assetPath);
  }
  for (const assetPath of found) assetQueue.add(assetPath);
}

function assetUrlFor(assetPath) {
  if (assetPath.startsWith("/assets/")) return `https://assets.parroto.app${assetPath.slice("/assets".length)}`;
  if (assetPath.startsWith("/podcast/")) return `https://podcast.parroto.app${assetPath.slice("/podcast".length)}`;
  return `${BASE}${assetPath}`;
}

async function downloadAsset(assetPath) {
  const url = /^https?:/i.test(assetPath) ? assetPath : assetUrlFor(assetPath);
  const target = localPathFor(assetPath);
  if (!force && fs.existsSync(target)) {
    const size = fs.statSync(target).size;
    if (size > 0) {
      stats.assets.ok += 1;
      stats.assets.bytes += size;
      downloaded.add(assetPath);
      await scanSavedFile(target, assetPath);
      return;
    }
  }
  try {
    const result = await fetchBuffer(url);
    if (result.notFound) {
      stats.assets.fail += 1;
      downloaded.add(assetPath);
      stats.failures.push({ url, reason: "not-found" });
      return;
    }
    if (result.buffer.length > maxAssetBytes) {
      stats.skipped += 1;
      downloaded.add(assetPath);
      stats.failures.push({ url, reason: `too-large ${result.buffer.length}` });
      return;
    }
    await saveFile(target, result.buffer);
    stats.assets.ok += 1;
    stats.assets.bytes += result.buffer.length;
    downloaded.add(assetPath);
    await scanSavedFile(target, assetPath, result.contentType);
  } catch (err) {
    stats.assets.fail += 1;
    downloaded.add(assetPath);
    stats.failures.push({ url, reason: String(err?.message ?? err) });
  }
}

async function scanSavedFile(target, assetPath, contentType) {
  if (contentType && !isTextType(contentType)) return;
  const ext = path.extname(target).toLowerCase();
  if (![".html", ".js", ".mjs", ".css", ".json", ".xml", ".txt", ".svg"].includes(ext)) return;
  let text;
  try {
    const buffer = await fsp.readFile(target);
    if (buffer.length > 12 * 1024 * 1024) return;
    text = buffer.toString("utf8");
  } catch {
    return;
  }
  collectFromText(text, assetPath);
}

async function runPool(items, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

async function drainAssets() {
  let guard = 0;
  while (assetQueue.size > 0) {
    guard += 1;
    if (guard > 40) break;
    const batch = [...assetQueue];
    assetQueue.clear();
    console.log(`asset wave ${guard}: ${batch.length} items`);
    await runPool(batch, async (assetPath) => {
      await downloadAsset(assetPath);
      const done = stats.assets.ok + stats.assets.fail;
      if (done % 100 === 0) console.log(`assets ok=${stats.assets.ok} fail=${stats.assets.fail} queue=${assetQueue.size}`);
    });
  }
}

async function fetchLocaleData() {
  const locales = JSON.parse(fs.readFileSync(path.join(DATA, "routes.json"), "utf8")).locales;
  for (const locale of locales) {
    const url = `${BASE}/_next/data/${BUILD_ID}/${locale}.json`;
    const target = path.join(PUBLIC, "_next", "data", BUILD_ID, `${locale}.json`);
    if (!force && fs.existsSync(target) && fs.statSync(target).size > 0) continue;
    try {
      const result = await fetchBuffer(url);
      if (result.notFound) {
        stats.failures.push({ url, reason: "not-found" });
        continue;
      }
      await saveFile(target, result.buffer);
      stats.assets.ok += 1;
      stats.assets.bytes += result.buffer.length;
    } catch (err) {
      stats.failures.push({ url, reason: String(err?.message ?? err) });
    }
  }
}

async function mirrorNotFoundPage() {
  const target = path.join(PUBLIC, "404.html");
  if (!force && fs.existsSync(target) && fs.statSync(target).size > 0) return;
  try {
    const result = await fetchBuffer(`${BASE}/404`, true);
    await fsp.mkdir(PUBLIC, { recursive: true });
    await fsp.writeFile(target, result.buffer);
    console.log(`404 page saved (${result.buffer.length} bytes)`);
  } catch (err) {
    stats.failures.push({ url: `${BASE}/404`, reason: String(err?.message ?? err) });
  }
}

async function walkHtml(directory) {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["_next", "assets", "assets.parroto.app", "podcast", "api", "blog"].includes(entry.name)) continue;
      files.push(...(await walkHtml(target)));
    } else if (entry.name.endsWith(".html")) {
      files.push(target);
    }
  }
  return files;
}

function routeUrlForFile(relative) {
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return "/" + relative.slice(0, relative.length - "index.html".length);
  return "/" + relative.slice(0, relative.length - ".html".length);
}

async function backfillData() {
  const files = await walkHtml(PUBLIC);
  let written = 0;
  for (const file of files) {
    const relative = path.relative(PUBLIC, file).split(path.sep).join("/");
    const before = dataWritten.size;
    await emitNextData(routeUrlForFile(relative), file);
    if (dataWritten.size > before) written += 1;
  }
  console.log(`data backfill: wrote ${written} data files from ${files.length} pages`);
}

async function main() {
  fs.mkdirSync(PUBLIC, { recursive: true });
  if (argv.backfill === "true") {
    await backfillData();
    return;
  }
  const inventory = JSON.parse(fs.readFileSync(path.join(DATA, "routes.json"), "utf8"));
  const routes = inventory.routes.filter((route) => groups.has(route.group) && !/\/404$/.test(route.url));
  console.log(`mirroring ${routes.length} pages from groups: ${[...groups].join(",")} concurrency=${concurrency}`);

  await fetchLocaleData();
  await mirrorNotFoundPage();

  await runPool(routes, async (route) => {
    await downloadPage(route.url);
  });
  console.log(`pages done ok=${stats.pages.ok} fail=${stats.pages.fail}`);

  for (const route of routes) {
    const target = localPathFor(route.url);
    await scanSavedFile(target, route.url);
  }
  await drainAssets();

  const report = {
    groups: [...groups],
    pages: stats.pages,
    assets: stats.assets,
    skipped: stats.skipped,
    failureCount: stats.failures.length,
    failuresByHost: stats.failures.reduce((acc, item) => {
      let host = "invalid";
      try {
        host = new URL(item.url).hostname;
      } catch {
        host = "relative";
      }
      acc[host] = (acc[host] ?? 0) + 1;
      return acc;
    }, {}),
    failures: stats.failures
  };
  const reportPath = path.join(DATA, `mirror-${[...groups].join("-")}.json`);
  await fsp.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ pages: stats.pages, assets: stats.assets, skipped: stats.skipped, failures: stats.failures.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
