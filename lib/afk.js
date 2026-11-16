/** AFK: remember who is away, tell people who mention them, welcome them back. */
const store = require('./jsonStore');
const FILE = 'afk.json';
const load = () => store.readJson(FILE, {});
const save = (d) => store.writeJson(FILE, d);
const dig = (x) => String(x || '').split('@')[0].split(':')[0].replace(/\D/g, '');

function ids(m, fallback) {
  const k = (m && m.key) || {};
  return [...new Set([k.participantPn, k.participant, k.senderPn, k.participantLid, fallback].map(dig).filter(Boolean))];
}
function set(m, jid, reason) {
  const d = load(); const mine = ids(m, jid);
  d[mine[0]] = { ids: mine, reason: String(reason || '').slice(0, 120), since: Date.now() };
  save(d); return d[mine[0]];
}
function find(d, id) { id = dig(id); return Object.entries(d).find(([, v]) => v.ids.includes(id)); }
const ago = (ms) => { const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? h + 'h ' + (m % 60) + 'm' : m ? m + 'm' : s + 's'; };

/** Returns lines to send (may be empty). Clears the sender's own AFK on any message. */
function check(m, jid, text, prefix) {
  const d = load(); const out = [];
  if (!Object.keys(d).length) return out;
  const mine = ids(m, jid);
  const own = mine.map((i) => find(d, i)).find(Boolean);
  const isAfkCmd = String(text || '').trim().toLowerCase().startsWith((prefix || '.') + 'afk');
  if (own && !isAfkCmd) { delete d[own[0]]; save(d); out.push('Welcome back. You were away for ' + ago(Date.now() - own[1].since) + '.'); }
  const ci = (m.message && (m.message.extendedTextMessage || {}).contextInfo) || {};
  const tagged = [...(ci.mentionedJid || []), ci.participant].filter(Boolean);
  const seen = new Set();
  for (const t of tagged) {
    const hit = find(d, t);
    if (!hit || seen.has(hit[0]) || (own && hit[0] === own[0])) continue;
    seen.add(hit[0]);
    out.push('@' + hit[0] + ' is AFK' + (hit[1].reason ? ': ' + hit[1].reason : '') + ' (' + ago(Date.now() - hit[1].since) + ' ago)');
  }
  return out;
}
module.exports = { set, check, ids };
