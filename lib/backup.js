/** Backup and restore of everything the bot keeps: rules, settings, warnings, protection, optional WhatsApp session. */
const fs = require('fs');
const path = require('path');

const APP = 'claudo-md';
const NAME_OK = /^[A-Za-z0-9._-]+$/;
const SKIP = new Set(['cfwd-pending.json', 'cfwd-failed.json']);
const MAX_SESSION_BYTES = 40 * 1024 * 1024;

const safeName = (n) => NAME_OK.test(n) && n !== '.' && n !== '..' && !n.includes('..');
const list = (dir) => { try { return fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isFile()); } catch (_) { return []; } };

function build({ dataDir, sessionDir, full = false }) {
  const files = {};
  for (const f of list(dataDir)) {
    if (!f.endsWith('.json') || SKIP.has(f) || f.includes('.corrupt-') || !safeName(f)) continue;
    files[f] = fs.readFileSync(path.join(dataDir, f), 'utf8');
  }
  const out = { app: APP, v: 1, createdAt: new Date().toISOString(), full: !!full, files };
  if (full) {
    const session = {}; let total = 0;
    for (const f of list(sessionDir)) {
      if (!safeName(f)) continue;
      const b = fs.readFileSync(path.join(sessionDir, f));
      total += b.length;
      if (total > MAX_SESSION_BYTES) break;
      session[f] = b.toString('base64');
    }
    out.session = session;
  }
  return out;
}

function validate(obj) {
  if (!obj || obj.app !== APP || typeof obj.files !== 'object') throw new Error('not a Claudo-MD backup file');
  for (const [n, v] of Object.entries(obj.files)) {
    if (!safeName(n) || !n.endsWith('.json')) throw new Error('bad file name in backup: ' + n);
    if (typeof v !== 'string') throw new Error('bad content for ' + n);
    JSON.parse(v);
  }
  for (const n of Object.keys(obj.session || {})) if (!safeName(n)) throw new Error('bad session file name: ' + n);
  return obj;
}

function atomicWrite(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
}

/** Writes backup content into the folders. Session only when withSession is true. */
function restore(obj, { dataDir, sessionDir, withSession = false }) {
  validate(obj);
  let data = 0, session = 0;
  for (const [n, v] of Object.entries(obj.files)) { atomicWrite(path.join(dataDir, n), v); data++; }
  if (withSession && obj.session) {
    for (const [n, v] of Object.entries(obj.session)) { atomicWrite(path.join(sessionDir, n), Buffer.from(v, 'base64')); session++; }
  }
  return { data, session };
}

const parse = (buf) => JSON.parse(Buffer.from(buf).toString('utf8'));
const stamp = (d = new Date()) => d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const fileName = (full) => 'claudo-backup-' + stamp() + (full ? '-full' : '') + '.json';
const summary = (o) => ({ files: Object.keys(o.files).length, session: Object.keys(o.session || {}).length, createdAt: o.createdAt });

/** Hourly check: send an automatic backup to the owner DM when due. */
let timer = null;
function startAuto(sock, config, { settings, dirs, ownerJid }) {
  if (timer) clearInterval(timer);
  const tick = async () => {
    const hours = Number(settings.get('autobackup') || 0);
    if (!(hours > 0)) return;
    const last = Number(settings.get('lastBackup') || 0);
    if (Date.now() - last < hours * 3600 * 1000) return;
    try {
      const b = build({ ...dirs(), full: false });
      await sock.sendMessage(ownerJid(config), { document: Buffer.from(JSON.stringify(b)), mimetype: 'application/json', fileName: fileName(false), caption: 'Automatic backup. Save this file; restore with .restore (reply to it).' });
      settings.set('lastBackup', Date.now());
    } catch (e) { console.warn('[autobackup]', e.message || e); }
  };
  timer = setInterval(tick, 60 * 60 * 1000);
  if (timer.unref) timer.unref();
  setTimeout(tick, 20000).unref && 0;
  return tick;
}

module.exports = { build, validate, restore, parse, fileName, summary, startAuto, safeName };
