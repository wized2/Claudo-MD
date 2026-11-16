/** Group protection: anti-link (off | warn | kick) and welcome messages. */
const store = require('./jsonStore');
const detect = require('./detect');
const ui = require('./ui');
const { bare } = require('./groupTools');
const { isOwner } = require('./owner');

const FILE = 'protect.json';
const load = () => store.readJson(FILE, {});
const save = (d) => store.writeJson(FILE, d);
function getCfg(jid) { return { antilink: 'off', welcome: false, badwords: [], antibad: 'off', ...(load()[jid] || {}) }; }
function setCfg(jid, patch) { const d = load(); d[jid] = { ...getCfg(jid), ...patch }; save(d); return d[jid]; }

const ANY_URL = /\b(?:https?:\/\/|www\.)\S+|\bchat\.whatsapp\.com\/\S+/i;
const hasLink = (text) => detect.findLinks(text).length > 0 || ANY_URL.test(detect.normalize(text));

/** Returns 'ignored' | 'deleted' | 'warned' | 'kicked'. Needs the bot to be an admin to act. */
async function checkAntiLink(sock, m, text, ctxLike) {
  const jid = m.key.remoteJid;
  const cfg = getCfg(jid);
  if (cfg.antilink === 'off' || m.key.fromMe || !hasLink(text)) return 'ignored';
  const meta = await sock.groupMetadata(jid);
  const adminIds = meta.participants.filter((x) => x.admin).flatMap((x) => [bare(x.id), bare(x.phoneNumber)]);
  const sender = bare(m.key.participantPn || m.key.participant);
  if (adminIds.includes(sender) || isOwner({ m, jid, sender: m.key.participant, sock, config: ctxLike.config })) return 'ignored';
  const me = [bare(sock.user && sock.user.id), bare(sock.user && sock.user.lid)];
  if (!me.some((x) => x && adminIds.includes(x))) return 'ignored';
  await sock.sendMessage(jid, { delete: m.key }).catch(() => {});
  const who = m.key.participant;
  if (cfg.antilink === 'kick') {
    await sock.groupParticipantsUpdate(jid, [who], 'remove').catch(() => {});
    await sock.sendMessage(jid, { text: ui.card('Anti link', [ui.row('removed', '@' + bare(who)), ui.small('links are not allowed here')], { foot: false }), mentions: [who] });
    return 'kicked';
  }
  await sock.sendMessage(jid, { text: ui.card('Anti link', [ui.row('user', '@' + bare(who)), ui.small('links are not allowed here')], { foot: false }), mentions: [who] });
  return 'warned';
}

const words = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const hitBad = (text, list) => { if (!list || !list.length) return null; const set = new Set(words(text)); return list.find((w) => set.has(w)) || null; };

/** Group-defined bad words. Returns 'ignored' | 'warned' | 'kicked'. Admins are exempt; bot must be admin. */
async function checkBadWords(sock, m, text, ctxLike) {
  const jid = m.key.remoteJid; const cfg = getCfg(jid);
  if (cfg.antibad === 'off' || m.key.fromMe || !hitBad(text, cfg.badwords)) return 'ignored';
  const meta = await sock.groupMetadata(jid);
  const adminIds = meta.participants.filter((x) => x.admin).flatMap((x) => [bare(x.id), bare(x.phoneNumber)]);
  const sender = bare(m.key.participantPn || m.key.participant);
  if (adminIds.includes(sender) || isOwner({ m, jid, sender: m.key.participant, sock, config: ctxLike.config })) return 'ignored';
  const me = [bare(sock.user && sock.user.id), bare(sock.user && sock.user.lid)];
  if (!me.some((x) => x && adminIds.includes(x))) return 'ignored';
  await sock.sendMessage(jid, { delete: m.key }).catch(() => {});
  const who = m.key.participant;
  if (cfg.antibad === 'kick') {
    await sock.groupParticipantsUpdate(jid, [who], 'remove').catch(() => {});
    await sock.sendMessage(jid, { text: ui.card('Anti bad words', [ui.row('removed', '@' + bare(who))], { foot: false }), mentions: [who] });
    return 'kicked';
  }
  await sock.sendMessage(jid, { text: ui.card('Anti bad words', [ui.row('user', '@' + bare(who)), ui.small('please keep the chat respectful')], { foot: false }), mentions: [who] });
  return 'warned';
}

async function onParticipants(sock, ev, config) {
  if (ev.action !== 'add') return;
  const cfg = getCfg(ev.id);
  if (!cfg.welcome) return;
  const meta = await sock.groupMetadata(ev.id).catch(() => null);
  const ids = (ev.participants || []).map((p) => (typeof p === 'string' ? p : p.id || p.phoneNumber));
  const text = ui.card('Welcome', [ids.map((i) => '@' + bare(i)).join(' '), meta ? ui.row('group', meta.subject) : '', meta && meta.desc ? ui.small(String(meta.desc).slice(0, 160)) : ''].filter(Boolean), { foot: false });
  await sock.sendMessage(ev.id, { text, mentions: ids });
}

module.exports = { getCfg, setCfg, hasLink, checkAntiLink, checkBadWords, hitBad, onParticipants };
