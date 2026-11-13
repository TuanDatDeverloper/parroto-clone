import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { contentTypeFor } from "./mime.mjs";

const ORIGIN = "https://parroto.app";
const HOST_PREFIXES = [
  ["/assets/", "https://assets.parroto.app/"],
  ["/podcast/", "https://podcast.parroto.app/"]
];
const inFlight = new Map();

export function originUrlFor(pathname, search = "") {
  for (const [prefix, host] of HOST_PREFIXES) {
    if (pathname.startsWith(prefix)) return `${host}${pathname.slice(prefix.length)}${search}`;
  }
  return `${ORIGIN}${pathname}${search}`;
}

export function cachePathFor(publicDir, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  const clean = decoded.replace(/^\/+/, "");
  const target = path.resolve(publicDir, clean);
  if (target !== publicDir && !target.startsWith(publicDir + path.sep)) return null;
  if (clean === "") return path.join(publicDir, "index.html");
  if (decoded.endsWith("/")) return path.join(target, "index.html");
  if (path.posix.extname(clean)) return target;
  return `${target}.html`;
}

async function download(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36",
      "accept-language": "en"
    }
  });
  if (!res.ok) return { status: res.status, contentType: null, body: null };
  return {
    status: res.status,
    contentType: res.headers.get("content-type") ?? contentTypeFor(url),
    body: Buffer.from(await res.arrayBuffer())
  };
}

export async function fetchOriginTarget(publicDir, pathname, search = "") {
  const url = originUrlFor(pathname, search);
  const destination = cachePathFor(publicDir, pathname);
  const key = `${url}|${destination ?? ""}`;
  if (inFlight.has(key)) return inFlight.get(key);

  const job = (async () => {
    const result = await download(url);
    if (result.body && destination) {
      await fsp.mkdir(path.dirname(destination), { recursive: true });
      await fsp.writeFile(destination, result.body);
      if (!fs.existsSync(destination)) return result;
    }
    return { ...result, cachedPath: result.body && destination ? destination : null };
  })();

  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
  }
}
