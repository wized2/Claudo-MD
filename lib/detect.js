/**
 * Promo / invite-spam detection for channel posts.
 * Normalizes text first (so tricks like zero-width chars, Arabic digits or spaced-out links
 * cannot slip through), then scores signals and reports reasons.
 */
const AR_DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };

function normalize(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[​-‏‪-‮⁠-⁩﻿]/g, '')
    .replace(/ـ/g, '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d])
    .replace(/[*_~`]+/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// whatsapp.com/channel|invite|g, chat.whatsapp.com, wa.me - tolerant of spaces, "dot" and "[.]" tricks
const LINK_RE = /(?:https?:\/\/)?(?:www\.)?(?:chat\s*[.\[(]*(?:dot)?[\])]*\s*)?(?:whatsapp\s*[.\[(]*(?:dot)?[\])]*\s*com|wa\s*[.\[(]*(?:dot)?[\])]*\s*me)\s*\/\s*[\w\-/=?&%.]+/gi;

function findLinks(text) {
  return normalize(text).match(LINK_RE) || [];
}

function stripWaLinks(text) {
  const raw = String(text || '').replace(/[​-‏‪-‮⁠-⁩﻿]/g, '');
  return raw
    .replace(LINK_RE, '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim())
    .filter((l, i, a) => l.length > 0 || (i > 0 && a[i - 1].length > 0))
    .join('\n')
    .trim();
}

const PROMO = /\b(join|follow|subscribe|share|invite|click (?:here|the link)|link in bio|official (?:channel|group)|our (?:channel|group)|whatsapp (?:group|channel))\b|جوائن|جوائین|فالو|شیئر|شئیر|چینل کا لنک|گروپ کا لنک|ہمارے (?:گروپ|چینل)|لنک\s*:|چینل ایڈمن|اشتراک|انضم|تابع|قناتنا|مجموعتنا/gi;

function analyze(text) {
  const n = normalize(text);
  const links = findLinks(text).length;
  const promoHits = (n.match(PROMO) || []).length;
  const lines = n.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const core = stripWaLinks(n).replace(/[\s\p{P}\p{S}]+/gu, '');
  const reasons = [];
  let score = 0;
  if (links) { score += links * 3; reasons.push(links + ' invite link(s)'); }
  if (promoHits) { score += Math.min(promoHits, 6) * 2; reasons.push(promoHits + ' promo word(s)'); }
  if (links && core.length < 60) { score += 3; reasons.push('almost only a link'); }
  if (lines.length >= 5) {
    const uniq = new Set(lines.map((l) => l.toLowerCase()));
    if (uniq.size <= Math.ceil(lines.length / 2)) { score += 2; reasons.push('repeated lines'); }
  }
  const linkOnly = links > 0 && core.length === 0;
  const spam = linkOnly || score >= 6 || (links >= 1 && promoHits >= 1);
  return { score, reasons, links, promoHits, linkOnly, spam };
}

module.exports = { normalize, findLinks, stripWaLinks, analyze };
