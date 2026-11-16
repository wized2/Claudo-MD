/** Aptoide search (keyless public API). fetchFn is injectable for tests. */
const BASE = () => process.env.APTOIDE_API || 'https://ws75.aptoide.com/api/7';
const MAX_MB = () => Number(process.env.APK_MAX_MB) || 100;

async function getJson(fetchFn, url, ms = 25000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Claudo-MD/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

const mb = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + ' MB');
const short = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n || 0));

function norm(a) {
  const f = a.file || {};
  return {
    name: a.name || a.package, pkg: a.package, version: f.vername || '', size: Number(a.size || f.filesize || 0),
    url: f.path || f.path_alt || '', md5: f.md5sum || '', icon: a.icon || '', dev: (a.developer && a.developer.name) || '',
    downloads: Number((a.stats && a.stats.downloads) || 0), rating: a.stats && a.stats.rating && a.stats.rating.avg || 0,
    trusted: !!(f.malware && /TRUSTED/i.test(f.malware.rank || '')), obb: !!a.obb, updated: a.updated || '',
  };
}

async function search(query, limit = 8, fetchFn = fetch) {
  const j = await getJson(fetchFn, `${BASE()}/apps/search?query=${encodeURIComponent(query)}&limit=${limit}`);
  const list = (j && j.datalist && j.datalist.list) || (j && j.list) || [];
  return list.map(norm).filter((x) => x.pkg && x.url);
}

/** Exact package lookup, falls back to the best search hit. */
async function byPackage(pkg, fetchFn = fetch) {
  const r = await search(pkg, 10, fetchFn);
  return r.find((x) => x.pkg === pkg) || null;
}

module.exports = { search, byPackage, norm, mb, short, MAX_MB };
