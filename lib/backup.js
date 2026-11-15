/**
 * State & Session Backup Manager for Claudo-MD
 * Creates and restores a single `.claudo.backup.json` containing:
 * - `data/` directory (settings.json, warns.json, protect.json, forwards.json, etc.)
 * - `session/` authentication credentials (creds.json, keys, etc.)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_BACKUP = '.claudo.backup.json';

function getBackupPath(customPath) {
  return path.resolve(ROOT, customPath || process.env.BACKUP_FILE || DEFAULT_BACKUP);
}

function createBackup(customPath) {
  const file = getBackupPath(customPath);
  const dataDir = path.join(ROOT, 'data');
  const sessionDir = path.join(ROOT, 'session');

  const bundle = {
    version: 1,
    createdAt: new Date().toISOString(),
    data: {},
    session: {},
  };

  if (fs.existsSync(dataDir)) {
    for (const f of fs.readdirSync(dataDir)) {
      const p = path.join(dataDir, f);
      if (fs.statSync(p).isFile() && !f.endsWith('.tmp')) {
        try {
          bundle.data[f] = fs.readFileSync(p, 'utf8');
        } catch (_) {}
      }
    }
  }

  if (fs.existsSync(sessionDir)) {
    for (const f of fs.readdirSync(sessionDir)) {
      const p = path.join(sessionDir, f);
      if (fs.statSync(p).isFile()) {
        try {
          bundle.session[f] = fs.readFileSync(p, 'utf8');
        } catch (_) {}
      }
    }
  }

  const json = JSON.stringify(bundle, null, 2);
  fs.writeFileSync(file, json, 'utf8');
  return { file, dataFiles: Object.keys(bundle.data).length, sessionFiles: Object.keys(bundle.session).length, size: Buffer.byteLength(json), buffer: Buffer.from(json) };
}

function restoreBackup(contentOrPath) {
  let bundle;
  if (typeof contentOrPath === 'string' && (contentOrPath.startsWith('{') || contentOrPath.startsWith('['))) {
    bundle = JSON.parse(contentOrPath);
  } else if (Buffer.isBuffer(contentOrPath)) {
    bundle = JSON.parse(contentOrPath.toString('utf8'));
  } else {
    const file = getBackupPath(contentOrPath);
    if (!fs.existsSync(file)) throw new Error('Backup file not found at: ' + file);
    bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  if (!bundle || (!bundle.data && !bundle.session)) {
    throw new Error('Invalid backup file format');
  }

  const dataDir = path.join(ROOT, 'data');
  const sessionDir = path.join(ROOT, 'session');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });

  let restoredData = 0;
  let restoredSession = 0;

  if (bundle.data) {
    for (const [name, content] of Object.entries(bundle.data)) {
      fs.writeFileSync(path.join(dataDir, name), String(content), 'utf8');
      restoredData++;
    }
  }

  if (bundle.session) {
    for (const [name, content] of Object.entries(bundle.session)) {
      fs.writeFileSync(path.join(sessionDir, name), String(content), 'utf8');
      restoredSession++;
    }
  }

  return { restoredData, restoredSession, createdAt: bundle.createdAt };
}

module.exports = { createBackup, restoreBackup, getBackupPath };
