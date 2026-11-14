/** Forward helpers: rules, settings, text transforms, channel media download + delivery. */
const store = require('./jsonStore');
const detect = require('./detect');
const { extractText } = require('./pluginLoader');

function loadRules() {
  const r = store.readJson('channel-forwards.json', []);
  return Array.isArray(r) ? r : [];
}
function saveRules(rules) {
  store.writeJson('channel-forwards.json', rules);
}

const DEFAULTS = { stripLinks: false, stripPromo: true };
function loadSettings() {
  return { ...DEFAULTS, ...(store.readJson('cfwd-settings.json', {}) || {}) };
}
function saveSettings(s) {
  const merged = { ...loadSettings(), ...(s || {}) };
  store.writeJson('cfwd-settings.json', merged);
  return merged;
}

function toBoldLine(label) {
  const s = String(label || '').trim().replace(/^\*+|\*+$/g, '');
  return s ? '*' + s + '*' : '';
}

/** Apply per-rule edits: strip phrases, links, replace pairs, prefix, footer. */
function transformText(text, rule, settings) {
  const st = settings || loadSettings();
  let out = String(text || '');
  const phrases = [].concat(rule.stripPhrases || [], rule.stripNames || []).map((p) => String(p).trim()).filter(Boolean);
  if (phrases.length) {
    out = out
      .split(/\r?\n/)
      .filter((line) => !phrases.some((p) => detect.normalize(line).toLowerCase().includes(detect.normalize(p).toLowerCase())))
      .join('\n');
  }
  if (st.stripLinks || rule.stripLinks) out = detect.stripWaLinks(out);
  for (const pair of rule.replace || []) {
    if (pair && pair.from != null) out = out.split(String(pair.from)).join(String(pair.to == null ? '' : pair.to));
  }
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (rule.prefix) out = String(rule.prefix) + out;
  const footer = rule.footer != null ? rule.footer : rule.footerText;
  if (footer != null && String(footer).length) {
    const line = rule.footerBold === false ? String(footer).trim() : toBoldLine(footer);
    out = out ? out + '\n\n' + line : line;
  }
  return out.trim();
}

function shouldSkipAsLinkSpam(text, hasMedia) {
  const st = loadSettings();
  if (!st.stripLinks && !st.stripPromo) return false;
  const d = detect.analyze(text);
  if (hasMedia) return false;
  return d.spam || (st.stripLinks && d.linkOnly);
}

function isChannelJid(jid) {
  if (typeof jid !== 'string') return false;
  return jid.endsWith('@newsletter') || jid.includes('@newsletter');
}

function parseChannelLink(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (isChannelJid(s)) return { inviteCode: null, postId: null, jid: s };
  const m = s.match(
    /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]+)(?:\/(\d+))?/i
  );
  if (!m) return null;
  return { inviteCode: m[1], postId: m[2] || null, jid: null };
}

async function resolveChannelFromLink(sock, input) {
  const parsed = parseChannelLink(input);
  if (!parsed) {
    const bare = String(input || '').trim();
    if (/^[A-Za-z0-9_-]{10,}$/.test(bare) && !bare.includes('@')) {
      return resolveInvite(sock, bare, null);
    }
    throw new Error('Not a channel link. Example: https://whatsapp.com/channel/XXXX');
  }
  if (parsed.jid) {
    return { jid: parsed.jid, inviteCode: null, postId: parsed.postId, meta: null };
  }
  return resolveInvite(sock, parsed.inviteCode, parsed.postId);
}

async function resolveInvite(sock, inviteCode, postId) {
  if (!sock || typeof sock.newsletterMetadata !== 'function') {
    throw new Error('Socket has no newsletterMetadata, update Baileys or pair again.');
  }
  const meta = await sock.newsletterMetadata('invite', inviteCode);
  const jid =
    meta?.id ||
    meta?.jid ||
    meta?.newsletterJid ||
    (typeof meta?.id === 'string' && !meta.id.includes('@')
      ? meta.id + '@newsletter'
      : null);
  if (!jid) {
    throw new Error('Could not resolve channel id from link.');
  }
  const normalized = isChannelJid(jid) ? jid : String(jid).replace(/@.*/, '') + '@newsletter';
  return {
    jid: normalized,
    inviteCode,
    postId: postId || null,
    meta,
    name: meta?.name || meta?.thread_metadata?.name?.text || meta?.subject || null,
  };
}

function unwrapMessage(message) {
  let msg = message;
  for (let i = 0; i < 12; i++) {
    if (!msg || typeof msg !== 'object') break;
    if (msg.ephemeralMessage?.message) { msg = msg.ephemeralMessage.message; continue; }
    if (msg.viewOnceMessage?.message) { msg = msg.viewOnceMessage.message; continue; }
    if (msg.viewOnceMessageV2?.message) { msg = msg.viewOnceMessageV2.message; continue; }
    if (msg.viewOnceMessageV2Extension?.message) { msg = msg.viewOnceMessageV2Extension.message; continue; }
    if (msg.documentWithCaptionMessage?.message) { msg = msg.documentWithCaptionMessage.message; continue; }
    if (msg.editedMessage?.message) { msg = msg.editedMessage.message; continue; }
    if (msg.groupMentionedMessage?.message) { msg = msg.groupMentionedMessage.message; continue; }
    if (msg.botInvokeMessage?.message) { msg = msg.botInvokeMessage.message; continue; }
    if (msg.associatedChildMessage?.message) { msg = msg.associatedChildMessage.message; continue; }
    break;
  }
  return msg || {};
}

function getCaptionOrText(message) {
  const text = extractText(message);
  if (text) return text;
  const msg = unwrapMessage(message);
  return (
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.extendedTextMessage?.text ||
    msg.conversation ||
    ''
  );
}

function mediaKind(msg) {
  if (!msg || typeof msg !== 'object') return null;
  if (msg.imageMessage) return 'image';
  if (msg.videoMessage) return 'video';
  if (msg.documentMessage) return 'document';
  if (msg.audioMessage) return 'audio';
  if (msg.stickerMessage) return 'sticker';
  if (msg.ptvMessage) return 'ptv';
  return null;
}

function mediaNode(msg) {
  if (!msg) return null;
  return (
    msg.imageMessage ||
    msg.videoMessage ||
    msg.documentMessage ||
    msg.audioMessage ||
    msg.stickerMessage ||
    msg.ptvMessage ||
    null
  );
}

/** WAMessage shape downloadMediaMessage expects (media on message root). */
function messageForDownload(m) {
  const top = m.message || {};
  if (mediaKind(top)) return m;
  const inner = unwrapMessage(top);
  if (mediaKind(inner)) {
    return {
      key: m.key,
      message: inner,
      messageTimestamp: m.messageTimestamp,
      pushName: m.pushName,
    };
  }
  return m;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toBase64(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return Buffer.from(v).toString('base64');
  } catch (_) {
    return '';
  }
}

function hasMediaKey(node) {
  const k = node && node.mediaKey;
  if (!k) return false;
  return typeof k === 'string' ? k.length > 0 : k.length > 0;
}

async function fetchPlain(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Channel (newsletter) media is NOT end-to-end encrypted: the node has url/directPath
 * but no mediaKey, so Baileys' keyed download helpers always throw for it.
 * Strategy: plain HTTPS fetch first (with sha256 check), keyed helpers only when a key exists.
 * Returns { buffer, kind, node } or null.
 */
async function downloadMedia(sock, m) {
  const baileys = require('baileys');
  const target = messageForDownload(m);
  const msg = unwrapMessage(target.message);
  const kind = mediaKind(msg);
  const node = mediaNode(msg);
  if (!kind || !node) {
    console.warn('[cfwd] no media node on message');
    return null;
  }
  const done = (buffer) => ({ buffer, kind, node: msg });
  const wantSha = toBase64(node.fileSha256);

  if (!hasMediaKey(node)) {
    const urls = [];
    if (node.directPath) {
      try {
        urls.push(baileys.getUrlFromDirectPath(node.directPath));
      } catch (_) {
        urls.push('https://mmg.whatsapp.net' + node.directPath);
      }
    }
    if (node.url) urls.push(node.url);
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const u of urls) {
        try {
          const buffer = await fetchPlain(u);
          if (!buffer.length) continue;
          if (wantSha) {
            const got = require('crypto').createHash('sha256').update(buffer).digest('base64');
            if (got !== wantSha) {
              console.warn('[cfwd] media sha mismatch, retrying');
              continue;
            }
          }
          console.log('[cfwd] media via plain fetch', kind, buffer.length);
          return done(buffer);
        } catch (e) {
          console.warn('[cfwd] plain media fetch', e.message || e);
        }
      }
      await sleep(700 * (attempt + 1));
    }
    return null;
  }

  // Keyed (encrypted) media: refresh CDN info once, then the stock helpers.
  let base = m;
  try {
    if (typeof sock.updateMediaMessage === 'function') {
      const updated = await sock.updateMediaMessage(base);
      if (updated && updated.message) base = updated;
    }
  } catch (e) {
    console.warn('[cfwd] updateMediaMessage', e.message || e);
  }
  const t2 = messageForDownload(base);
  try {
    const buf = await baileys.downloadMediaMessage(t2, 'buffer', {}, {
      reuploadRequest: sock.updateMediaMessage ? sock.updateMediaMessage.bind(sock) : undefined,
    });
    if (buf && buf.length) return done(Buffer.from(buf));
  } catch (e) {
    console.warn('[cfwd] downloadMediaMessage', e.message || e);
  }
  try {
    const typeMap = { image: 'image', video: 'video', document: 'document', audio: 'audio', sticker: 'sticker', ptv: 'video' };
    const stream = await baileys.downloadContentFromMessage(node, typeMap[kind] || 'document');
    const buffer = await streamToBuffer(stream);
    if (buffer.length) return done(buffer);
  } catch (e) {
    console.warn('[cfwd] downloadContentFromMessage', e.message || e);
  }
  return null;
}

async function sendWithRetry(sock, jid, content, tries) {
  tries = tries || 3;
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await sock.sendMessage(jid, content);
    } catch (e) {
      last = e;
      console.warn('[cfwd] send try', i + 1, e.message || e);
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

async function sendMediaPayload(sock, to, dl, caption, extra) {
  const { buffer, kind, node } = dl;
  const send = (_s, _t, content) => sendWithRetry(sock, to, extra ? { ...content, ...extra } : content);
  if (kind === 'image' && node.imageMessage) {
    return send(sock, to, {
      image: buffer,
      caption: caption || undefined,
      mimetype: node.imageMessage.mimetype || 'image/jpeg',
    });
  }
  if ((kind === 'video' || kind === 'ptv') && (node.videoMessage || node.ptvMessage)) {
    const meta = node.videoMessage || node.ptvMessage;
    return send(sock, to, {
      video: buffer,
      caption: caption || undefined,
      mimetype: meta.mimetype || 'video/mp4',
      ptv: kind === 'ptv',
    });
  }
  if (kind === 'document' && node.documentMessage) {
    return send(sock, to, {
      document: buffer,
      mimetype: node.documentMessage.mimetype || 'application/octet-stream',
      fileName: node.documentMessage.fileName || 'file',
      caption: caption || undefined,
    });
  }
  if (kind === 'audio' && node.audioMessage) {
    await send(sock, to, {
      audio: buffer,
      mimetype: node.audioMessage.mimetype || 'audio/ogg; codecs=opus',
      ptt: !!node.audioMessage.ptt,
    });
    if (caption) return send(sock, to, { text: caption });
    return;
  }
  if (kind === 'sticker' && node.stickerMessage) {
    await send(sock, to, { sticker: buffer });
    if (caption) return send(sock, to, { text: caption });
    return;
  }
  return send(sock, to, {
    document: buffer,
    fileName: 'attachment',
    mimetype: 'application/octet-stream',
    caption: caption || undefined,
  });
}

function normalizeChannelJid(jid) {
  const s = String(jid || '').trim();
  if (!s) return s;
  const base = s.split(':')[0]; // strip device suffix
  if (base.includes('@newsletter')) return base;
  if (/^\d+$/.test(base)) return base + '@newsletter';
  return s;
}

/**
 * Download channel media (plain fetch) and re-send it as a normal group/channel message.
 * Returns false when the media could not be fetched so the caller can retry later
 * instead of silently dropping the attachment.
 */
async function deliverMedia(sock, to, m, text, extra) {
  const kind = mediaKind(unwrapMessage(m.message));
  if (!kind) return false;
  for (let i = 0; i < 2; i++) {
    try {
      const dl = await downloadMedia(sock, m);
      if (dl && dl.buffer && dl.buffer.length) {
        await sendMediaPayload(sock, to, dl, text, extra);
        console.log('[cfwd] sent media', kind, to, dl.buffer.length);
        return true;
      }
    } catch (e) {
      console.warn('[cfwd] media send try', i + 1, e.message || e);
    }
    await sleep(800 * (i + 1));
  }
  return false;
}

module.exports = {
  loadRules, saveRules, loadSettings, saveSettings, isChannelJid, parseChannelLink, resolveChannelFromLink,
  transformText, shouldSkipAsLinkSpam, getCaptionOrText, toBoldLine, mediaKind, mediaNode, unwrapMessage,
  downloadMedia, deliverMedia, sendMediaPayload, sendWithRetry, normalizeChannelJid, sleep,
};
