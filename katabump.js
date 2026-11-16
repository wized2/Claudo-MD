#!/usr/bin/env node
/**
 * Claudo-MD - KataBump runner
 * Put this file at the HOST ROOT (e.g. /home/container/index.js).
 *
 *   ./index.js     this runner
 *   ./data/        your rules, settings, warnings (kept across updates)
 *   ./session/     WhatsApp login (kept across updates)
 *   ./bot/         cloned code, refreshed on update
 *   ./claudo-backup-*.json   drop a backup file here to restore it on start
 *
 * Update only refreshes ./bot and never touches data/ or session/.
 */
var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var execSync = require('child_process').execSync;

var CONFIG = {
  phone: process.env.PHONE || process.env.OWNER || '923073477752',
  port: Number(process.env.PORT) || 20003,
  repoUrl: process.env.REPO_URL || 'https://github.com/wized2/Claudo-MD.git',
  branch: process.env.BRANCH || 'main',
  updateEveryMin: Number(process.env.UPDATE_EVERY_MIN || 5),
};

var ROOT = path.dirname(require.main && require.main.filename ? require.main.filename : path.resolve(process.argv[1] || '.'));
var BOT = path.join(ROOT, 'bot');
var DATA = path.join(ROOT, 'data');
var SESSION = path.join(ROOT, 'session');
var PHONE = String(CONFIG.phone).replace(/\D/g, '');
var BRANCH = String(CONFIG.branch);

function log() { console.log.apply(console, [new Date().toISOString().slice(11, 19)].concat([].slice.call(arguments))); }
function q(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }
function sh(cmd, o) {
  o = o || {};
  return execSync(cmd, { cwd: o.cwd || BOT, stdio: o.silent ? 'pipe' : 'inherit', encoding: 'utf8' });
}
function nonEmpty(d) { try { return fs.readdirSync(d).length > 0; } catch (e) { return false; } }

function ensureBot() {
  if (!fs.existsSync(path.join(BOT, 'package.json'))) {
    log('cloning bot into', BOT);
    try { fs.rmSync(BOT, { recursive: true, force: true }); } catch (e) {}
    sh('git clone --depth 1 -b ' + q(BRANCH) + ' ' + q(CONFIG.repoUrl) + ' ' + q(BOT), { cwd: ROOT });
  }
  if (!fs.existsSync(path.join(BOT, 'node_modules', 'baileys'))) {
    log('npm install in bot/');
    sh('npm install --omit=dev', { cwd: BOT });
  }
}

function head() { try { return sh('git rev-parse HEAD', { silent: true }).trim(); } catch (e) { return ''; } }

function update() {
  try {
    var before = head();
    sh('git fetch --depth 1 origin ' + q(BRANCH), { silent: true });
    sh('git reset --hard origin/' + BRANCH, { silent: true });
    var after = head();
    if (before && after && before !== after) {
      log('bot updated', before.slice(0, 7), '->', after.slice(0, 7));
      try { sh('npm install --omit=dev'); } catch (e) { log('npm', e.message); }
      return true;
    }
  } catch (e) { log('update check', e.message); }
  return false;
}

/** Restore from a backup file placed at the host root, only when data/ is empty. */
function autoRestore() {
  fs.mkdirSync(DATA, { recursive: true });
  fs.mkdirSync(SESSION, { recursive: true });
  if (nonEmpty(DATA)) return;
  var files;
  try {
    files = fs.readdirSync(ROOT).filter(function (f) { return /^claudo-backup.*\.json$/.test(f); }).sort();
  } catch (e) { return; }
  if (!files.length) return;
  var pick = files[files.length - 1];
  try {
    var B = require(path.join(BOT, 'lib', 'backup.js'));
    var obj = B.validate(B.parse(fs.readFileSync(path.join(ROOT, pick))));
    var r = B.restore(obj, { dataDir: DATA, sessionDir: SESSION, withSession: !nonEmpty(SESSION) });
    log('restored', pick, '-', r.data, 'data files,', r.session, 'session files');
    try { fs.renameSync(path.join(ROOT, pick), path.join(ROOT, pick + '.restored')); } catch (e) {}
  } catch (e) { log('restore skipped:', e.message); }
}

/** Rolling local safety copies in ./backups (last 5), taken at start and before applying an update. */
function snapshot(tag) {
  try {
    var B = require(path.join(BOT, 'lib', 'backup.js'));
    var dir = path.join(ROOT, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    var b = B.build({ dataDir: DATA, sessionDir: SESSION, full: false });
    if (!Object.keys(b.files).length) return;
    fs.writeFileSync(path.join(dir, 'auto-' + tag + '-' + Date.now() + '.json'), JSON.stringify(b));
    var old = fs.readdirSync(dir).filter(function (f) { return /^auto-.*\.json$/.test(f); }).sort();
    while (old.length > 5) { try { fs.unlinkSync(path.join(dir, old.shift())); } catch (e) {} }
  } catch (e) { log('snapshot skipped:', e.message); }
}

var child = null, stopping = false, fast = 0, startedAt = 0;
function start() {
  if (child) { try { child.kill('SIGTERM'); } catch (e) {} child = null; }
  log('start - phone', PHONE, '- port', CONFIG.port, '- version', head().slice(0, 7));
  startedAt = Date.now();
  child = spawn(process.execPath, ['index.js'], {
    cwd: BOT,
    stdio: 'inherit',
    env: Object.assign({}, process.env, {
      PORT: String(CONFIG.port), PHONE: PHONE, OWNER: PHONE, PAIR_NUMBER: PHONE,
      SESSION_DIR: SESSION, FORWARDS_JSON: path.join(DATA, 'channel-forwards.json'),
    }),
  });
  child.on('exit', function (c, s) {
    log('bot exited', c, s || '');
    child = null;
    if (stopping) return;
    fast = Date.now() - startedAt < 20000 ? Math.min(fast + 1, 5) : 0;
    var wait = 3000 * Math.pow(2, fast);
    if (fast) log('crashed quickly, waiting', Math.round(wait / 1000) + 's');
    setTimeout(start, wait);
  });
}

log('Claudo-MD runner - branch', BRANCH, '- root', ROOT);
ensureBot();
update();
autoRestore();
snapshot('start');
start();
setInterval(function () { snapshot('update'); if (update()) { log('restarting for update'); start(); } }, Math.max(1, CONFIG.updateEveryMin) * 60000);
['SIGINT', 'SIGTERM'].forEach(function (sig) {
  process.on(sig, function () { stopping = true; if (child) child.kill('SIGTERM'); process.exit(0); });
});
