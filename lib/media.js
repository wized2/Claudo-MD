/** Helpers to find and download media from the message or the message it replies to. */
const baileys = require('baileys');
const { unwrapMessage, mediaKind } = require('./forward');
const { ctxInfo } = require('./target');

/** Returns { msg, kind, viewOnce, node } for the replied message, else for the message itself, else null. */
function findMedia(m) {
  const own = unwrapMessage(m.message);
  const ci = ctxInfo(m);
  const candidates = [];
  if (ci.quotedMessage) {
    const raw = ci.quotedMessage;
    const vo = !!(raw.viewOnceMessage || raw.viewOnceMessageV2 || raw.viewOnceMessageV2Extension);
    candidates.push({ message: unwrapMessage(raw), viewOnce: vo, quoted: true, ci });
  }
  candidates.push({ message: own, viewOnce: false, quoted: false });
  for (const c of candidates) {
    const kind = mediaKind(c.message);
    if (kind) {
      const node = c.message[kind === 'ptv' ? 'ptvMessage' : kind + 'Message'];
      const viewOnce = c.viewOnce || !!(node && node.viewOnce);
      const key = c.quoted ? { remoteJid: m.key.remoteJid, id: c.ci.stanzaId, participant: c.ci.participant, fromMe: false } : m.key;
      return { msg: { key, message: c.message }, kind, node, viewOnce };
    }
  }
  return null;
}

async function download(sock, found) {
  const buf = await baileys.downloadMediaMessage(found.msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage && sock.updateMediaMessage.bind(sock) });
  return Buffer.from(buf);
}

module.exports = { findMedia, download };
