/** Small keyless API helpers. fetchFn is injectable for tests. */
async function getJson(fetchFn, url, ms = 20000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetchFn(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Claudo-MD/1.0', Accept: 'application/json' } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const e = encodeURIComponent;

/** Prayer times via aladhan.com. input: "Lahore" or "Lahore, Pakistan" */
async function prayer(input, fetchFn = fetch) {
  const [c, k] = String(input || 'Karachi').split(',').map((s) => s.trim());
  const city = c || 'Karachi', country = k || process.env.PRAYER_COUNTRY || 'Pakistan';
  const j = await getJson(fetchFn, `https://api.aladhan.com/v1/timingsByCity?city=${e(city)}&country=${e(country)}&method=${process.env.PRAYER_METHOD || 1}`);
  const d = j && j.data;
  if (!d || !d.timings) return null;
  const t = d.timings;
  return { city, country, date: d.date && d.date.readable, hijri: d.date && d.date.hijri && d.date.hijri.date, tz: d.meta && d.meta.timezone, lat: d.meta && d.meta.latitude, lng: d.meta && d.meta.longitude, times: { Fajr: t.Fajr, Sunrise: t.Sunrise, Dhuhr: t.Dhuhr, Asr: t.Asr, Maghrib: t.Maghrib, Isha: t.Isha } };
}

/** Quran ayah "2:255" or global number; returns Arabic + Urdu (Jalandhry). */
async function ayah(ref, fetchFn = fetch) {
  const r = String(ref || '').trim();
  if (!/^\d{1,3}(:\d{1,3})?$|^\d{1,4}$/.test(r)) return null;
  const j = await getJson(fetchFn, `https://api.alquran.cloud/v1/ayah/${e(r)}/editions/quran-uthmani,ur.jalandhry`);
  const d = j && j.data;
  if (!Array.isArray(d) || d.length < 2) return null;
  return { surah: d[0].surah.englishName, arabicName: d[0].surah.name, n: d[0].numberInSurah, surahNo: d[0].surah.number, arabic: d[0].text, urdu: d[1].text };
}

/** GitHub user or owner/repo */
async function github(q, fetchFn = fetch) {
  const s = String(q || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/+$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(s)) {
    const r = await getJson(fetchFn, `https://api.github.com/repos/${s}`);
    if (!r) return null;
    return { kind: 'repo', name: r.full_name, desc: r.description || '', stars: r.stargazers_count, forks: r.forks_count, issues: r.open_issues_count, lang: r.language || '', license: (r.license && r.license.spdx_id) || '', updated: (r.pushed_at || '').slice(0, 10), url: r.html_url, avatar: r.owner && r.owner.avatar_url };
  }
  if (/^[\w-]{1,39}$/.test(s)) {
    const u = await getJson(fetchFn, `https://api.github.com/users/${s}`);
    if (!u) return null;
    return { kind: 'user', name: u.login, full: u.name || '', bio: u.bio || '', repos: u.public_repos, followers: u.followers, following: u.following, since: (u.created_at || '').slice(0, 10), location: u.location || '', url: u.html_url, avatar: u.avatar_url };
  }
  return null;
}

async function pokemon(q, fetchFn = fetch) {
  const s = String(q || '').trim().toLowerCase();
  if (!/^[a-z0-9-]{1,40}$/.test(s)) return null;
  const p = await getJson(fetchFn, `https://pokeapi.co/api/v2/pokemon/${s}`, 25000);
  if (!p) return null;
  const art = p.sprites && ((p.sprites.other && p.sprites.other['official-artwork'] && p.sprites.other['official-artwork'].front_default) || p.sprites.front_default);
  return { id: p.id, name: p.name, height: p.height / 10, weight: p.weight / 10, types: (p.types || []).map((t) => t.type.name), abilities: (p.abilities || []).map((a) => a.ability.name), stats: Object.fromEntries((p.stats || []).map((x) => [x.stat.name, x.base_stat])), image: art || '' };
}

/** Binance spot 24h ticker, e.g. btc -> BTCUSDT */
async function crypto(sym, fetchFn = fetch) {
  const base = String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!base || base.length > 12) return null;
  const pair = /(USDT|BUSD|USDC)$/.test(base) ? base : base + 'USDT';
  let j;
  try { j = await getJson(fetchFn, `https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`); } catch (er) { if (/HTTP 400/.test(er.message)) return null; throw er; }
  if (!j || !j.lastPrice) return null;
  return { pair, price: Number(j.lastPrice), change: Number(j.priceChangePercent), high: Number(j.highPrice), low: Number(j.lowPrice), volume: Number(j.quoteVolume) };
}
/** Hadith from Sahih al-Bukhari in Urdu + Arabic (fawazahmed0 hadith-api on jsDelivr). n = 1..7563 */
const CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';
async function hadith(n, fetchFn = fetch) {
  const num = parseInt(n, 10);
  if (!(num >= 1 && num <= 7563)) return null;
  const pick = (j) => { if (!j) return null; const arr = Array.isArray(j.hadiths) ? j.hadiths : [j]; return arr.find((h) => Number(h.hadithnumber) === num) || (arr.length === 1 ? arr[0] : null); };
  const en = pick(await getJson(fetchFn, `${CDN}urd-bukhari/${num}.json`));
  if (!en || !en.text) return null;
  let ar = null;
  try { const a = pick(await getJson(fetchFn, `${CDN}ara-bukhari/${num}.json`)); ar = a && a.text; } catch (_) {}
  const ref = en.reference || {};
  return { n: num, urdu: String(en.text).trim(), arabic: ar ? String(ar).trim() : '', book: ref.book, inBook: ref.hadith };
}

/** Qibla bearing in degrees from true north for a point. */
async function qibla(lat, lng, fetchFn = fetch) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  const j = await getJson(fetchFn, `https://api.aladhan.com/v1/qibla/${lat}/${lng}`);
  const d = j && j.data;
  if (!d || typeof d.direction !== 'number') return null;
  return d.direction;
}
const compass = (deg) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

const num = (n) => (n >= 1 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(+n.toPrecision(4)));

module.exports = { prayer, ayah, github, pokemon, crypto, hadith, qibla, compass, num };
