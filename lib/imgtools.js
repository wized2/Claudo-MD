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
module.exports = { toSticker, stickerToPng, qrPng, shorten };
