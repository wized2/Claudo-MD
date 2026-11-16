const fs = require('fs');
const path = require('path');
const pino = require('pino');
const qrcode = require('qrcode');
const config = require('./config');
const { loadPlugins, matchPlugin, extractText } = require('./lib/pluginLoader');
const { startPairServer } = require('./lib/pairServer');
const msgStore = require('./lib/msgStore');
const antiBan = require('./lib/antiBan');
const channelPoll = require('./lib/channelPoll');
const engine = require('./lib/cfwdEngine');
const forward = require('./lib/forward');
const botState = require('./lib/botState');
const protect = require('./lib/protect');
const backup = require('./lib/backup');
const features = require('./lib/features');
const settingsStore = require('./lib/settings');
const jsonStore = require('./lib/jsonStore');
const { isOwner } = require('./lib/owner');
const ui = require('./lib/ui');
const baileys = require('baileys');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = baileys;

process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', (e && e.stack) || e));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', (e && e.stack) || e));

const sessionDir = path.resolve(config.sessionDir);
fs.mkdirSync(sessionDir, { recursive: true });
const startedAt = Date.now();

let plugins = loadPlugins(path.join(__dirname, 'plugins'));
global.reloadPlugins = () => {
  try {
    plugins = loadPlugins(path.join(__dirname, 'plugins'));
  } catch (e) {
    console.error('[plugins] reload failed', e.message);
  }
};
try {
  let t = null;
  fs.watch(path.join(__dirname, 'plugins'), { persistent: false }, (_e, f) => {
    if (!f || !String(f).endsWith('.js')) return;
    clearTimeout(t);
    t = setTimeout(global.reloadPlugins, 400);
  });
} catch (_) {}

const state = { connected: false, user: null, lastQrDataUrl: null, pairingCode: null, message: 'Starting', updatedAt: Date.now(), socketReady: false, registered: false, lastError: null, requestPairingCode: null };
startPairServer(config, state);

let sockRef = null;
let waitedForQr = false;
let pairingInFlight = null;

const clearSession = () => {
  try {
    for (const f of fs.readdirSync(sessionDir)) fs.unlinkSync(path.join(sessionDir, f));
  } catch (_) {}
};

const CONTROL = new Set(['stop', 'start', 'status']);

async function startBot() {
  const { state: auth, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();
  const retryCache = new Map();
  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: { creds: auth.creds, keys: makeCacheableSignalKeyStore(auth.keys, pino({ level: 'silent' })) },
    browser: Browsers.macOS('Chrome'),
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    getMessage: msgStore.getMessage,
    msgRetryCounterCache: { get: (k) => retryCache.get(k), set: (k, v) => (retryCache.set(k, v), true), del: (k) => retryCache.delete(k), flushAll: () => retryCache.clear() },
  });
  sockRef = sock;
  waitedForQr = false;
  pairingInFlight = null;
  state.socketReady = false;
  state.registered = !!sock.authState.creds.registered;

  state.clearSessionAndRestart = async () => {
    clearSession();
    Object.assign(state, { connected: false, registered: false, pairingCode: null, lastQrDataUrl: null, user: null, socketReady: false, message: 'Session cleared, reconnecting', updatedAt: Date.now() });
    try { sock.ev.removeAllListeners('connection.update'); sock.end(undefined); } catch (_) {}
    setTimeout(() => startBot().catch(console.error), 800);
  };

  state.requestPairingCode = async (raw) => {
    if (sock.authState.creds.registered) throw new Error(state.connected ? 'Already linked. Clear session to re-pair.' : 'Saved session is reconnecting. Wait for Connected.');
    const number = String(raw || '').replace(/\D/g, '');
    if (number.length < 10 || number.length > 15) throw new Error('Use country code + number, digits only.');
    const deadline = Date.now() + 45000;
    while (!waitedForQr && Date.now() < deadline) await new Promise((r) => setTimeout(r, 400));
    if (!waitedForQr) throw new Error('Handshake not ready, try again in a few seconds.');
    if (pairingInFlight) return pairingInFlight;
    pairingInFlight = sock
      .requestPairingCode(number)
      .then((c) => {
        const code = String(c).replace(/\W/g, '').toUpperCase();
        state.pairingCode = code.length === 8 ? code.slice(0, 4) + '-' + code.slice(4) : code;
        state.updatedAt = Date.now();
        return state.pairingCode;
      })
      .finally(() => { pairingInFlight = null; });
    return pairingInFlight;
  };

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      waitedForQr = true;
      state.socketReady = true;
      try { state.lastQrDataUrl = await qrcode.toDataURL(qr); } catch (_) {}
      state.message = 'Ready. Scan the QR or get a pairing code.';
      state.updatedAt = Date.now();
    }
    if (connection === 'open') {
      Object.assign(state, { connected: true, registered: true, user: sock.user || null, pairingCode: null, lastQrDataUrl: null, message: 'Connected', lastError: null, updatedAt: Date.now() });
      console.log('[bot] connected as', sock.user && sock.user.id);
      try { channelPoll.startChannelPoll(sock, config); } catch (e) { console.warn('[cfwd-poll]', e.message); }
      try { backup.startAuto(sock, config, { settings: settingsStore, dirs: () => ({ dataDir: jsonStore.dataDir(), sessionDir }), ownerJid: (c) => String(c.ownerNumber || '').replace(/\D/g, '') + '@s.whatsapp.net' }); } catch (e) { console.warn('[autobackup]', e.message); }
    }
    if (connection === 'close') {
      try { channelPoll.stopChannelPoll(); } catch (_) {}
      const code = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      Object.assign(state, { connected: false, user: null, socketReady: false, lastError: String(code || 'unknown'), message: loggedOut ? 'Logged out. Pair again.' : 'Disconnected (' + (code || '?') + '), reconnecting', updatedAt: Date.now() });
      if (loggedOut || code === 401) clearSession();
      if (!loggedOut) setTimeout(() => startBot().catch(console.error), 2500);
    }
  });

  sock.ev.on('call', (calls) => { features.onCall(sock, calls).catch(() => {}); });

  sock.ev.on('group-participants.update', (ev) => { protect.onParticipants(sock, ev, config).catch((e) => console.warn('[welcome]', e.message)); });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const m of messages || []) {
      try {
        if (!m || !m.message) continue;
        msgStore.put(m);
        const jid = m.key && m.key.remoteJid;
        if (m.message.protocolMessage) { features.onRevoke(sock, m, config).catch(() => {}); continue; }
        if (!jid || jid === 'status@broadcast' || m.message.reactionMessage) continue;
        if (jid.includes('@newsletter')) {
          await engine.handleMessage(sock, m, config).catch((e) => console.error('[cfwd]', e.message));
          continue;
        }
        if (type !== 'notify' && type !== 'append') continue;
        if (type === 'notify' && !m.key.fromMe && features.on('autoread')) sock.readMessages([m.key]).catch(() => {});
        const text = extractText(m.message).trim();
        if (!text) continue;
        if (jid.endsWith('@g.us') && !botState.isIdle()) {
          const r = await protect.checkAntiLink(sock, m, text, { config }).catch(() => 'ignored');
          if (r !== 'ignored') continue;
        }
        const hit = matchPlugin(plugins, text, config.prefix);
        if (!hit) continue;
        if (botState.isIdle() && !CONTROL.has(hit.plugin.name)) continue;

        const sender = m.key.participantPn || m.key.senderPn || m.key.participant || m.participant || jid;
        const group = antiBan.isGroup(jid);
        const send = (content, opts) =>
          antiBan.enqueueSend(async () => {
            const body = typeof content === 'string' ? { text: antiBan.softText(content, group) } : content;
            const sent = await sock.sendMessage(jid, body, { quoted: m, ...(opts || {}) });
            if (sent) msgStore.put(sent);
            return sent;
          });
        const ctx = { sock, m, jid, sender, text, arg: hit.arg, args: hit.args || [], cmd: hit.cmd, config, plugins, group, ui, startedAt, prefix: config.prefix, reply: send };
        ctx.isOwner = isOwner(ctx);
        const p = hit.plugin;
        if (features.isPrivate() && !ctx.isOwner) continue;
        if (p.owner && !ctx.isOwner) { await send(ui.small('owner only')); continue; }
        if (features.on('typing')) sock.sendPresenceUpdate('composing', jid).catch(() => {});
        if (p.group && !group) { await send(ui.small('groups only')); continue; }
        if (!antiBan.allowCommand(jid).ok) continue;
        console.log('[cmd]', hit.cmd, 'by', sender);
        await p.handler(ctx);
      } catch (e) {
        console.error('[msg]', e);
      }
    }
  });
}

startBot().catch((e) => {
  console.error('Fatal', e);
  process.exit(1);
});
