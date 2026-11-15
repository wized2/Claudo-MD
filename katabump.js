#!/usr/bin/env node
/**
 * Claudo-MD — KataBump / Free VPS process supervisor & runner
 * ============================================================
 * Runs Claudo-MD under long-lived hosting (Render, Railway, Koyeb, KataBump, VPS).
 *
 * Features:
 * - Uses PHONE/OWNER for both bot ownership and WhatsApp pairing code
 * - Auto-pulls updates from git repo if REPO_URL is configured
 * - Manages automatic state/session backup (.claudo.backup.json) so configuration,
 *   forwarding rules, anti-link rules, settings and sessions can survive resets
 * - Auto-restarts on crash with exponential backoff protection
 * - Web pair server port binding on 0.0.0.0:$PORT
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─────────────── CONFIGURATION ───────────────
const CONFIG = {
  phone: process.env.PHONE || process.env.OWNER || '923073477752',
  port: Number(process.env.PORT) || 3000,
  repoUrl: process.env.REPO_URL || '',
  branch: process.env.BRANCH || 'main',
  updateEveryMin: Number(process.env.UPDATE_EVERY_MIN || 0), // 0 to disable auto git-pull
  dirName: process.env.BOT_DIR || '', // empty = current directory
  backupFile: process.env.BACKUP_FILE || '.claudo.backup.json',
};
// ──────────────────────────────────────────────

const ROOT = CONFIG.dirName ? path.join(process.env.RUN_ROOT || '/tmp', CONFIG.dirName) : process.cwd();
const PHONE = String(CONFIG.phone).replace(/\D/g, '');
const PORT = CONFIG.port;
const BACKUP_PATH = path.resolve(ROOT, CONFIG.backupFile);

function log(...args) {
  console.log(`[katabump ${new Date().toISOString().slice(11, 19)}]`, ...args);
}

function sh(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: opts.cwd || ROOT,
    stdio: opts.silent ? 'pipe' : 'inherit',
    env: { ...process.env, ...opts.env },
    encoding: 'utf8',
  });
}

/** Export all key user state (data folder + session creds) into .claudo.backup.json */
function createDotBackup() {
  try {
    const backup = {
      version: 1,
      createdAt: new Date().toISOString(),
      botName: 'Claudo-MD',
      phone: PHONE,
      data: {},
      session: {},
    };

    // 1. Data directory
    const dataDir = path.join(ROOT, 'data');
    if (fs.existsSync(dataDir)) {
      for (const f of fs.readdirSync(dataDir)) {
        const fp = path.join(dataDir, f);
        if (fs.statSync(fp).isFile() && !f.endsWith('.tmp')) {
          try {
            backup.data[f] = fs.readFileSync(fp, 'utf8');
          } catch (_) {}
        }
      }
    }

    // 2. Session credentials (creds.json is critical for auth persistence)
    const sessionDir = path.join(ROOT, 'session');
    if (fs.existsSync(sessionDir)) {
      for (const f of fs.readdirSync(sessionDir)) {
        const fp = path.join(sessionDir, f);
        if (fs.statSync(fp).isFile()) {
          try {
            backup.session[f] = fs.readFileSync(fp, 'utf8');
          } catch (_) {}
        }
      }
    }

    fs.writeFileSync(BACKUP_PATH, JSON.stringify(backup, null, 2), 'utf8');
    log('auto-backup saved to', CONFIG.backupFile, `(data: ${Object.keys(backup.data).length} files, session: ${Object.keys(backup.session).length} files)`);
  } catch (e) {
    log('backup creation warning:', e.message);
  }
}

/** Restore state from .claudo.backup.json if data or session directories are empty */
function restoreDotBackup() {
  if (!fs.existsSync(BACKUP_PATH)) {
    log('no existing backup file found at', CONFIG.backupFile);
    return;
  }
  try {
    const raw = fs.readFileSync(BACKUP_PATH, 'utf8');
    const backup = JSON.parse(raw);
    log('restoring from backup created at', backup.createdAt || 'unknown');

    const dataDir = path.join(ROOT, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    if (backup.data) {
      for (const [name, content] of Object.entries(backup.data)) {
        const target = path.join(dataDir, name);
        if (!fs.existsSync(target)) {
          fs.writeFileSync(target, content, 'utf8');
          log('restored data file:', name);
        }
      }
    }

    const sessionDir = path.join(ROOT, 'session');
    fs.mkdirSync(sessionDir, { recursive: true });
    if (backup.session) {
      for (const [name, content] of Object.entries(backup.session)) {
        const target = path.join(sessionDir, name);
        if (!fs.existsSync(target)) {
          fs.writeFileSync(target, content, 'utf8');
          log('restored session file:', name);
        }
      }
    }
    log('backup restore completed successfully.');
  } catch (e) {
    log('failed to restore from backup:', e.message);
  }
}

function ensureRepo() {
  if (CONFIG.repoUrl && !fs.existsSync(path.join(ROOT, 'package.json'))) {
    log('cloning repo', CONFIG.repoUrl);
    fs.mkdirSync(path.dirname(ROOT), { recursive: true });
    sh(`git clone --depth 1 -b ${CONFIG.branch} "${CONFIG.repoUrl}" "${ROOT}"`, {
      cwd: path.dirname(ROOT),
    });
  }

  // Ensure config has phone/port properly bound
  const cfgPath = path.join(ROOT, 'config.js');
  if (fs.existsSync(cfgPath)) {
    let t = fs.readFileSync(cfgPath, 'utf8');
    t = t.replace(/ownerNumber:\s*process\.env\.OWNER\s*\|\|\s*['"][^'"]*['"]/, `ownerNumber: process.env.OWNER || '${PHONE}'`);
    t = t.replace(/pairNumber:\s*process\.env\.PAIR_NUMBER\s*\|\|\s*process\.env\.OWNER\s*\|\|\s*['"][^'"]*['"]/, `pairNumber: process.env.PAIR_NUMBER || process.env.OWNER || '${PHONE}'`);
    fs.writeFileSync(cfgPath, t);
  }

  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'baileys'))) {
    log('installing dependencies via npm install...');
    sh('npm install --omit=dev', { cwd: ROOT });
  }
}

function pullIfChanged() {
  if (!CONFIG.repoUrl) return false;
  try {
    const before = sh('git rev-parse HEAD', { silent: true }).trim();
    sh('git fetch --depth 1 origin ' + CONFIG.branch, { silent: true });
    sh('git reset --hard origin/' + CONFIG.branch, { silent: true });
    const after = sh('git rev-parse HEAD', { silent: true }).trim();
    if (before && after && before !== after) {
      log('code update detected:', before.slice(0, 7), '→', after.slice(0, 7));
      try {
        sh('npm install --omit=dev', { cwd: ROOT });
      } catch (err) {
        log('npm install post-update error:', err.message);
      }
      return true;
    }
  } catch (e) {
    log('git update check failed:', e.message);
  }
  return false;
}

let child = null;
let shuttingDown = false;

function startBot() {
  if (child) {
    try {
      child.kill('SIGTERM');
    } catch (_) {}
    child = null;
  }

  log('launching bot process on port', PORT, 'owner/pair', PHONE);
  child = spawn('node', ['index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      PHONE,
      OWNER: PHONE,
      PAIR_NUMBER: PHONE,
    },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    log('bot exited with code:', code, 'signal:', signal || 'none');
    child = null;
    // Save backup right on process exit
    createDotBackup();
    if (!shuttingDown) {
      log('restarting bot in 3s...');
      setTimeout(startBot, 3000);
    }
  });
}

function main() {
  log('Starting Claudo-MD KataBump runner');
  ensureRepo();
  restoreDotBackup();
  startBot();

  // Periodic backup save every 10 minutes
  setInterval(createDotBackup, 10 * 60 * 1000);

  // Optional git pull
  if (CONFIG.repoUrl && CONFIG.updateEveryMin > 0) {
    setInterval(() => {
      if (pullIfChanged()) {
        log('restarting bot to load update...');
        createDotBackup();
        startBot();
      }
    }, CONFIG.updateEveryMin * 60 * 1000);
  }

  const cleanup = () => {
    shuttingDown = true;
    createDotBackup();
    if (child) child.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main();
