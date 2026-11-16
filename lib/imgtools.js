const sharp = require('sharp');
const qrcode = require('qrcode');

/** Any image buffer -> 512x512 transparent WebP sticker. */
async function toSticker(buf) {
  return sharp(buf, { animated: false }).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 80 }).toBuffer();
}
/** WebP sticker -> PNG. */
async function stickerToPng(buf) { return sharp(buf).png().toBuffer(); }
/** Text -> PNG QR with margin and clean colors. */
async function qrPng(text) { return qrcode.toBuffer(String(text).slice(0, 1000), { type: 'png', width: 640, margin: 2, errorCorrectionLevel: 'M' }); }

async function shorten(url, fetchFn = fetch) {
  const u = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  const tries = [
    async () => { const r = await fetchFn('https://is.gd/create.php?format=simple&url=' + encodeURIComponent(u)); const t = (await r.text()).trim(); if (!r.ok || !/^https?:\/\//.test(t)) throw new Error(t || 'is.gd failed'); return t; },
    async () => { const r = await fetchFn('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(u)); const t = (await r.text()).trim(); if (!r.ok || !/^https?:\/\//.test(t)) throw new Error('tinyurl failed'); return t; },
  ];
  let last;
  for (const t of tries) { try { return await t(); } catch (e) { last = e; } }
  throw last;
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Text -> 512x512 WebP sticker (white text, dark outline, auto-wrapped). */
async function textSticker(text, color) {
  const words = String(text).replace(/\s+/g, ' ').trim().slice(0, 120).split(' ');
  const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > 12 && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  const longest = Math.max(...lines.map((l) => [...l].length), 1);
  const size = Math.max(36, Math.min(150, Math.floor(480 / (longest * 0.6)), Math.floor(480 / (lines.length * 1.25))));
  const y0 = 256 - ((lines.length - 1) * size * 1.2) / 2 + size * 0.32;
  const fill = color || '#ffffff';
  const tx = lines.map((l, k) => `<text x="256" y="${(y0 + k * size * 1.2).toFixed(1)}" text-anchor="middle" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-weight="bold" font-size="${size}" fill="${fill}" stroke="#111" stroke-width="${Math.max(4, size / 9)}" paint-order="stroke">${esc(l)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">${tx}</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}

module.exports = { textSticker, toSticker, stickerToPng, qrPng, shorten };
