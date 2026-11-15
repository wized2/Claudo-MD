/** Keyless download APIs (no heavy deps). fetchFn is injectable for tests. */
const YT_BASES = () => [process.env.YT_API || 'https://you-tube-dl-psi.vercel.app'];
const PROXY = process.env.YT_PROXY || 'https://tube-grab-beta.vercel.app/api/proxy?url=';
const MAX_BYTES = 64 * 1024 * 1024;

async function getJson(fetchFn, url, ms = 30000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Claudo-MD/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/** YouTube link or search text -> { title, duration, url, thumbnail, download } */
async function ytInfo(query, format = 'audio', fetchFn = fetch) {
  const q = encodeURIComponent(query);
  const direct = YT_BASES().map((b) => `${b}/youtube?url=${q}&format=${format}`);
  const urls = [...direct, ...direct.map((u) => PROXY + encodeURIComponent(u))];
  let last;
  for (const u of urls) {
    try {
      const j = await getJson(fetchFn, u);
      const d = j && j.data && j.data.ytdl;
      if (j && j.status !== false && d && d.download) return { title: d.title || 'Untitled', duration: d.duration || 0, url: d.url || '', thumbnail: d.thumbnail || '', download: d.download };
      last = new Error((j && (j.message || j.error)) || 'no result');
    } catch (e) { last = e; }
  }
  throw last || new Error('no result');
}

/** TikTok link -> { title, author, video, music, cover } (no watermark when available). */
async function tiktok(url, fetchFn = fetch) {
  const j = await getJson(fetchFn, 'https://www.tikwm.com/api/?hd=1&url=' + encodeURIComponent(url));
  const d = j && j.data;
  if (!j || j.code !== 0 || !d) throw new Error((j && j.msg) || 'no result');
  const abs = (p) => (p && p.startsWith('/') ? 'https://www.tikwm.com' + p : p);
  return { title: d.title || '', author: (d.author && (d.author.nickname || d.author.unique_id)) || '', video: abs(d.hdplay || d.play), music: abs(d.music), cover: abs(d.cover), images: (d.images || []).map(abs) };
}

/** Download to a Buffer with a size cap. Returns { buffer } or { tooBig: true, size }. */
async function fetchBuffer(url, fetchFn = fetch, max = MAX_BYTES) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 150000);
  try {
    const r = await fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Claudo-MD/1.0' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const len = Number(r.headers.get('content-length') || 0);
    if (len > max) return { tooBig: true, size: len };
    const buffer = Buffer.from(await r.arrayBuffer());
    if (buffer.length > max) return { tooBig: true, size: buffer.length };
    return { buffer, type: r.headers.get('content-type') || '' };
  } finally { clearTimeout(t); }
}

const isYouTube = (s) => /(?:youtube\.com|youtu\.be)\//i.test(s);
const isTikTok = (s) => /tiktok\.com\//i.test(s);
const mins = (s) => { s = Number(s) || 0; return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

module.exports = { ytInfo, tiktok, fetchBuffer, isYouTube, isTikTok, mins, MAX_BYTES };
