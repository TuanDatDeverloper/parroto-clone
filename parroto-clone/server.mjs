import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { contentTypeFor, isTextContentType } from "./lib/mime.mjs";
import { rewriteBody } from "./lib/rewrite.mjs";
import { loadApiManifest, resolveApiFallbackPath, resolveApiFixture } from "./lib/api-fixtures.mjs";
import { fetchOriginTarget } from "./lib/origin-fallback.mjs";

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, "public");
const API_DIR = path.join(PUBLIC, "api");
const portArg = process.argv.find((arg) => arg.startsWith("--port="));
const PORT = Number(portArg ? portArg.split("=")[1] : process.env.PORT ?? 4173);

const apiManifest = loadApiManifest(API_DIR);
const MUTABLE_CACHE = "no-cache";

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function safeJoin(base, relative) {
  const target = path.resolve(base, relative);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

function resolveStatic(pathname) {
  const decoded = decodeURIComponent(pathname);
  const clean = decoded.replace(/^\/+/, "");
  const candidates = [];
  if (clean === "") {
    candidates.push(safeJoin(PUBLIC, "index.html"));
  } else if (decoded.endsWith("/")) {
    candidates.push(safeJoin(PUBLIC, path.join(clean, "index.html")));
  } else {
    candidates.push(safeJoin(PUBLIC, clean));
    candidates.push(safeJoin(PUBLIC, path.join(clean, "index.html")));
    if (!path.posix.extname(clean)) candidates.push(safeJoin(PUBLIC, clean + ".html"));
  }
  for (const candidate of candidates) {
    if (candidate && isFile(candidate)) return candidate;
  }
  return null;
}

function cachePolicy() {
  return MUTABLE_CACHE;
}

async function sendFile(req, res, filePath, { status = 200, rewrite = true } = {}) {
  const contentType = contentTypeFor(filePath);
  const text = isTextContentType(contentType);
  let payload;
  if (text) {
    const raw = await fsp.readFile(filePath, "utf8");
    payload = Buffer.from(rewrite ? rewriteBody(raw) : raw, "utf8");
  } else {
    payload = await fsp.readFile(filePath);
  }
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": payload.length,
    "cache-control": cachePolicy(filePath)
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(payload);
}

async function handleNextImage(req, res, url) {
  const source = url.searchParams.get("url");
  if (!source) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "missing url" }));
    return;
  }
  const target = resolveStatic(source.startsWith("/") ? source : `/${source}`);
  if (!target) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not mirrored", source }));
    return;
  }
  await sendFile(req, res, target, { rewrite: false });
}

async function handleApi(req, res, url) {
  const method = req.method ?? "GET";
  const entry = resolveApiFixture(apiManifest, method, url.pathname, url.search) ?? resolveApiFallbackPath(API_DIR, url.pathname);
  if (!entry) {
    const payload = Buffer.from(JSON.stringify({ error: "endpoint not captured" }));
    res.writeHead(404, {
      "content-type": "application/json; charset=utf-8",
      "content-length": payload.length,
      "access-control-allow-origin": "*"
    });
    res.end(payload);
    return;
  }
  const payload = await fsp.readFile(entry.file);
  res.writeHead(entry.status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": payload.length,
    "cache-control": MUTABLE_CACHE,
    "access-control-allow-origin": "*"
  });
  if (method === "HEAD") {
    res.end();
    return;
  }
  res.end(payload);
}

async function handleOriginFallback(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    res.end("method not allowed");
    return true;
  }
  const fetched = await fetchOriginTarget(PUBLIC, url.pathname, url.search);
  if (!fetched.body) return false;
  const contentType = fetched.contentType ?? "application/octet-stream";
  let payload = fetched.body;
  if (isTextContentType(contentType)) payload = Buffer.from(rewriteBody(fetched.body.toString("utf8")), "utf8");
  res.writeHead(200, {
    "content-type": contentType,
    "content-length": payload.length,
    "cache-control": cachePolicy(fetched.cachedPath ?? path.join(PUBLIC, "index.html"))
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  res.end(payload);
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/cdn-cgi/rum") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (url.pathname === "/_next/image") {
      await handleNextImage(req, res, url);
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    const filePath = resolveStatic(url.pathname);
    if (filePath) {
      await sendFile(req, res, filePath);
      return;
    }

    if (await handleOriginFallback(req, res, url)) return;

    const notFound = safeJoin(PUBLIC, "404.html");
    if (notFound && isFile(notFound)) {
      await sendFile(req, res, notFound, { status: 404 });
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404");
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: String(err?.message ?? err) }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`parroto clone running at http://127.0.0.1:${PORT}`);
});
