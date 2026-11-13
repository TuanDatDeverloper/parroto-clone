import fs from 'node:fs';
import path from 'node:path';

const MANIFEST_FILE = '_fixtures.json';

function normalize(value, apiDirectory) {
  if (typeof value === 'string') return { file: path.join(apiDirectory, value), status: 200 };
  if (value && typeof value === 'object' && typeof value.file === 'string') {
    return { file: path.join(apiDirectory, value.file), status: Number(value.status ?? 200) };
  }
  return null;
}

export function loadApiManifest(apiDirectory) {
  const manifestPath = path.join(apiDirectory, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) return new Map();
  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entries = new Map();
  for (const [key, value] of Object.entries(parsed)) {
    const entry = normalize(value, apiDirectory);
    if (entry) entries.set(key, entry);
  }
  return entries;
}

export function resolveApiFixture(manifest, method, pathname, search) {
  const base = pathname.replace(/\/+$/, '') || '/api';
  const exact = manifest.get(`${method} ${base}${search}`);
  if (exact) return exact;
  const withoutQuery = manifest.get(`${method} ${base}`);
  if (withoutQuery) return withoutQuery;
  if (method !== 'GET' && method !== 'HEAD') {
    const getEquivalent = manifest.get(`GET ${base}${search}`) ?? manifest.get(`GET ${base}`);
    if (getEquivalent) return getEquivalent;
    return null;
  }
  return null;
}

export function resolveApiFallbackPath(apiDirectory, pathname) {
  const relative = decodeURIComponent(pathname.replace(/^\/api\/?/, '')).replace(/\/+$/, '');
  if (!relative) return null;
  const candidates = [path.join(apiDirectory, `${relative}.json`), path.join(apiDirectory, relative, 'index.json')];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return { file: candidate, status: 200 };
  }
  return null;
}
