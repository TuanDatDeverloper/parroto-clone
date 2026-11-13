import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROUTES_FILE = path.join(ROOT, "data", "routes.json");
const REPORT_FILE = path.join(ROOT, "data", "verify-open.json");

const options = { base: "http://127.0.0.1:4173", concurrency: 16 };

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--base=")) options.base = arg.slice("--base=".length);
  if (arg.startsWith("--concurrency=")) options.concurrency = Number(arg.split("=")[1]);
}

async function probe(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    const body = res.body ? await res.arrayBuffer() : new ArrayBuffer(0);
    return { status: res.status, bytes: body.byteLength, type: res.headers.get("content-type") };
  } catch (err) {
    return { status: 0, bytes: 0, type: null, error: String(err.message ?? err) };
  }
}

async function main() {
  const inventory = JSON.parse(fs.readFileSync(ROUTES_FILE, "utf8"));
  const failures = [];
  const byGroup = {};
  let done = 0;

  const queue = [...inventory.routes];
  const workers = Array.from({ length: options.concurrency }, async () => {
    while (queue.length > 0) {
      const entry = queue.shift();
      const result = await probe(`${options.base}${entry.url}`);
      const group = (byGroup[entry.group] ??= { total: 0, ok: 0, failed: 0, bytes: 0 });
      group.total += 1;
      group.bytes += result.bytes;
      const healthy = result.status === 200 && result.bytes > 0;
      if (healthy) group.ok += 1;
      else {
        group.failed += 1;
        failures.push({ url: entry.url, group: entry.group, ...result });
      }
      done += 1;
      if (done % 500 === 0) console.log(`probed ${done}/${inventory.routes.length} failures=${failures.length}`);
    }
  });

  await Promise.all(workers);

  const report = { base: options.base, total: inventory.routes.length, byGroup, failures };
  fs.writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ total: report.total, byGroup, failures: failures.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
