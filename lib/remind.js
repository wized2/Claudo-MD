/** Reminders: ".remind 10m take medicine". Persisted, re-armed on start. */
const store = require('./jsonStore');
const FILE = 'reminders.json';
const MAX = 24 * 86400 * 1000; // setTimeout limit is ~24.8 days
const load = () => store.readJson(FILE, []);
const save = (d) => store.writeJson(FILE, d);

function parseDelay(s) {
  const re = /(\d+(?:\.\d+)?)\s*(d|h|m|s)/gi; let ms = 0, n = 0, x;
  const str = String(s || '').trim();
  while ((x = re.exec(str))) { n++; ms += parseFloat(x[1]) * { d: 864e5, h: 36e5, m: 6e4, s: 1e3 }[x[2].toLowerCase()]; }
  return n && str.replace(re, '').trim() === '' ? Math.round(ms) : 0;
}
const timers = new Map();
function arm(sock, r) {
  const wait = Math.max(0, r.at - Date.now());
  if (wait > MAX) return;
  clearTimeout(timers.get(r.id));
  const t = setTimeout(async () => {
    timers.delete(r.id);
    const ok = await sock.sendMessage(r.jid, { text: 'Reminder' + (r.text ? ': ' + r.text : ''), mentions: r.who ? [r.who] : [] }, r.quoted ? { quoted: r.quoted } : undefined).then(() => true).catch(() => false);
    if (ok || Date.now() - r.at > 3600e3) save(load().filter((x) => x.id !== r.id));
  }, wait);
  if (t.unref) t.unref();
  timers.set(r.id, t);
}
function add(sock, { jid, who, text, ms }) {
  if (!(ms >= 1000 && ms <= MAX)) throw new Error('time must be between 1s and 24d');
  const list = load();
  if (list.filter((x) => x.jid === jid).length >= 20) throw new Error('too many reminders in this chat');
  const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), jid, who, text: String(text || '').slice(0, 300), at: Date.now() + ms };
  list.push(r); save(list); arm(sock, r); return r;
}
const restore = (sock) => { for (const r of load()) arm(sock, r); };
const forChat = (jid) => load().filter((x) => x.jid === jid).sort((a, b) => a.at - b.at);
const cancel = (jid, id) => { const l = load(); const n = l.filter((x) => !(x.jid === jid && x.id === id)); save(n); clearTimeout(timers.get(id)); timers.delete(id); return n.length !== l.length; };
const _clear = () => { for (const t of timers.values()) clearTimeout(t); timers.clear(); };
module.exports = { parseDelay, add, restore, forChat, cancel, _clear };
