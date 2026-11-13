import fs from "node:fs";
import path from "node:path";

const BASE = "https://parroto.app";
const BUILD_ID = "5yvq-OgoPecVqxR6LR8-B";
const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const DATA_DIR = path.join(PUBLIC, "_next", "data", BUILD_ID);
const ROUTES_FILE = path.join(ROOT, "data", "routes.json");
const REPORT_FILE = path.join(ROOT, "data", "mirror-data.json");
const MIN_BYTES = 512;

const options = { concurrency: 10, force: false };

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--concurrency=")) options.concurrency = Number(arg.split("=")[1]);
  if (arg === "--force") options.force = true;
}

function localeOf(url) {
  const segments = url.split("/").filter(Boolean);
  const locales = JSON.parse(fs.readFileSync(ROUTES_FILE, "utf8")).locales;
  if (segments.length === 0) return { locale: "en", route: "/" };
  if (locales.includes(segments[0])) {
    return { locale: segments[0], route: `/${segments.slice(1).join("/")}` };
  }
  return { locale: "en", route: `/${segments.join("/")}` };
}

function dataUrlFor(url) {
  const { locale, route } = localeOf(url);
  const suffix = route === "/" ? "" : route;
  return `${BASE}/_next/data/${BUILD_ID}/${locale}${suffix}.json`;
}

function dataPathFor(url) {
  const { locale, route } = localeOf(url);
  const suffix = route === "/" ? "" : route;
  return path.join(DATA_DIR, `${locale}${suffix}.json`);
}

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
        accept: "application/json"
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (attempt >= 4) throw err;
    await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    return fetchJson(url, attempt + 1);
  }
}

async function main() {
  const inventory = JSON.parse(fs.readFileSync(ROUTES_FILE, "utf8"));
  const targets = inventory.routes.filter((entry) => entry.group !== "blog");
  const failures = [];
  const skipped = [];
  let done = 0;
  let downloaded = 0;
  let bytes = 0;

  const queue = [...targets];
  const workers = Array.from({ length: options.concurrency }, async () => {
    while (queue.length > 0) {
      const entry = queue.shift();
      const destination = dataPathFor(entry.url);
      if (!options.force && fs.existsSync(destination) && fs.statSync(destination).size >= MIN_BYTES) {
        skipped.push(entry.url);
        done += 1;
        continue;
      }
      try {
        const body = await fetchJson(dataUrlFor(entry.url));
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, body);
        downloaded += 1;
        bytes += body.length;
      } catch (err) {
        failures.push({ url: entry.url, error: String(err.message ?? err) });
      }
      done += 1;
      if (done % 250 === 0) console.log(`data done=${done}/${targets.length} downloaded=${downloaded} ${(bytes / 1048576).toFixed(1)}MB`);
    }
  });

  await Promise.all(workers);

  const report = {
    total: targets.length,
    downloaded,
    skipped: skipped.length,
    failed: failures.length,
    bytes,
    failures
  };
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, failures: failures.length, skipped: skipped.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
