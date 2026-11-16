const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

test('pfp and group plugins load and resolve targets', async () => {
  const { loadPlugins, matchPlugin } = require('../lib/pluginLoader');
  const plugins = loadPlugins(path.join(__dirname, '..', 'plugins'));
  for (const c of ['pfp', 'kick', 'warn', 'tagall', 'link']) assert.ok(matchPlugin(plugins, '.' + c + ' 1', '.'), c);
  const { resolveTarget } = require('../lib/target');
  const sock = { onWhatsApp: async (j) => [{ exists: true, jid: j }] };
  let t = await resolveTarget({ sock, m: { message: {} }, args: ['+92 300 1234567'] });
  assert.equal(t.number, '923001234567');
  t = await resolveTarget({ sock, m: { message: { extendedTextMessage: { contextInfo: { participant: '111@s.whatsapp.net' } } } }, args: [] });
  assert.equal(t.number, '111');
  t = await resolveTarget({ sock, m: { message: { extendedTextMessage: { contextInfo: { mentionedJid: ['222@s.whatsapp.net'] } } } }, args: [] });
  assert.equal(t.number, '222');
});

test('tic tac toe logic and bot never loses', () => {
  const t = require('../lib/ttt');
  assert.equal(t.winner(['X','X','X',null,null,null,null,null,null]), 'X');
  const b = Array(9).fill(null);
  let turn = 'X';
  while (!t.winner(b) && !t.full(b)) {
    const mv = turn === 'O' ? t.bestMove(b, 'O') : b.findIndex((c) => !c); // X plays first free cell
    b[mv] = turn; turn = turn === 'X' ? 'O' : 'X';
  }
  assert.notEqual(t.winner(b), 'X');
});

test('games plugin: ttt flow vs bot, guess, trivia', async () => {
  const { loadPlugins } = require('../lib/pluginLoader');
  const plugins = loadPlugins(path.join(__dirname, '..', 'plugins'));
  const sent = [];
  const mk = (args, sender = '1@s.whatsapp.net') => ({ jid: 'g@g.us', sender, args, prefix: '.', config: { prefix: '.', botName: 'B' }, m: {}, sock: { relayMessage: async () => { sent.push('native'); } }, reply: async (c) => { sent.push(typeof c === 'string' ? c : c.text || c); } });
  const ttt = plugins.find((p) => p.name === 'ttt');
  await ttt.handler(mk(['bot']));
  for (let i = 1; i <= 9; i++) await ttt.handler(mk([String(i)]));
  assert.ok(sent.length > 3);
  const guess = plugins.find((p) => p.name === 'guess');
  await guess.handler(mk([])); await guess.handler(mk(['50']));
  const tr = plugins.find((p) => p.name === 'trivia');
  await tr.handler(mk([])); await tr.handler(mk(['a', '0']));
  assert.ok(sent.length > 6);
});

test('protect: link detection, antilink flow, welcome', async () => {
  const P = require('../lib/protect');
  assert.equal(P.hasLink('hi https://example.com'), true);
  assert.equal(P.hasLink('join chat.whatsapp.com/ABCdef123'), true);
  assert.equal(P.hasLink('nothing here'), false);
  const G = '123@g.us'; const calls = [];
  const sock = {
    user: { id: '999:1@s.whatsapp.net' },
    groupMetadata: async () => ({ subject: 'T', participants: [{ id: '999@s.whatsapp.net', admin: 'admin' }, { id: '111@s.whatsapp.net' }, { id: '222@s.whatsapp.net', admin: 'admin' }] }),
    sendMessage: async (j, c) => { calls.push(['send', c]); },
    groupParticipantsUpdate: async (j, u, a) => { calls.push(['upd', a]); },
  };
  const mk = (who) => ({ key: { remoteJid: G, participant: who, id: 'm1' } });
  P.setCfg(G, { antilink: 'kick' });
  assert.equal(await P.checkAntiLink(sock, mk('111@s.whatsapp.net'), 'visit https://x.com', { config: { ownerNumber: '5' } }), 'kicked');
  assert.equal(await P.checkAntiLink(sock, mk('222@s.whatsapp.net'), 'visit https://x.com', { config: { ownerNumber: '5' } }), 'ignored'); // admin
  P.setCfg(G, { antilink: 'off' });
  assert.equal(await P.checkAntiLink(sock, mk('111@s.whatsapp.net'), 'https://x.com', { config: {} }), 'ignored');
  P.setCfg(G, { welcome: true });
  calls.length = 0;
  await P.onParticipants(sock, { id: G, action: 'add', participants: ['333@s.whatsapp.net'] });
  assert.ok(calls.some((c) => c[0] === 'send' && c[1].mentions));
});

test('minigames: play opens in-chat HTML app, falls back to file', async () => {
  const { loadPlugins } = require('../lib/pluginLoader');
  const plugins = loadPlugins(path.join(__dirname, '..', 'plugins'));
  const out = []; const relayed = [];
  const mk = (args, sock) => ({ jid: 'u@s.whatsapp.net', sender: 'u@s.whatsapp.net', args, prefix: '.', config: { prefix: '.', botName: 'B' }, m: {}, sock, reply: async (c) => out.push(c) });
  const good = { user: { id: '111:2@s.whatsapp.net' }, relayMessage: async (j, m) => relayed.push(m) };
  await plugins.find((p) => p.name === 'games').handler(mk([], good));
  const play = plugins.find((p) => p.name === 'play');
  await play.handler(mk(['snake'], good));
  const rich = relayed.find((m) => m.botForwardedMessage && m.botForwardedMessage.message.richResponseMessage);
  assert.ok(rich, 'in-chat rich message relayed');
  const data = rich.botForwardedMessage.message.richResponseMessage.unifiedResponse.data;
  const payload = JSON.parse(Buffer.from(data, 'base64').toString());
  assert.ok(payload.sections[0].view_model.primitive.payload.includes('<canvas'));
  assert.ok(!out.some((o) => o && o.document));
  out.length = 0;
  await play.handler(mk(['snake', 'file'], good));
  const doc = out.find((o) => o && o.document);
  assert.ok(doc && doc.fileName === 'Snake.html' && doc.mimetype === 'text/html');
  out.length = 0;
  await play.handler(mk(['quiz'], { user: { id: '1:1@s.whatsapp.net' }, relayMessage: async () => { throw new Error('nope'); } }));
  assert.ok(out.some((o) => o && o.document), 'falls back to file when in-chat fails');
  out.length = 0; await play.handler(mk(['nope'], good));
  assert.equal(typeof out[0], 'string');
});

test('tools: qr, sticker, toimg, shorten, media lookup', async () => {
  const img = require('../lib/imgtools');
  const sharp = require('sharp');
  const png = await img.qrPng('https://example.com');
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const src = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#f00' } }).png().toBuffer();
  const st = await img.toSticker(src);
  const meta = await sharp(st).metadata();
  assert.equal(meta.format, 'webp'); assert.equal(meta.width, 512); assert.equal(meta.height, 512);
  assert.equal((await sharp(await img.stickerToPng(st)).metadata()).format, 'png');
  const fake = async (u) => ({ ok: true, text: async () => 'https://is.gd/abc' });
  assert.equal(await img.shorten('example.com', fake), 'https://is.gd/abc');
  const { findMedia } = require('../lib/media');
  const m = { key: { remoteJid: 'g@g.us', id: 'A' }, message: { extendedTextMessage: { text: '.vv', contextInfo: { stanzaId: 'Q1', participant: '1@s.whatsapp.net', quotedMessage: { viewOnceMessageV2: { message: { imageMessage: { caption: 'x', viewOnce: true } } } } } } } };
  const f = findMedia(m);
  assert.equal(f.kind, 'image'); assert.equal(f.viewOnce, true); assert.equal(f.msg.key.id, 'Q1');
  assert.equal(findMedia({ key: {}, message: { conversation: 'hi' } }), null);
  const { loadPlugins } = require('../lib/pluginLoader');
  const ps = loadPlugins(path.join(__dirname, '..', 'plugins'));
  for (const n of ['qr', 'short', 'sticker', 'toimg', 'vv']) assert.ok(ps.find((p) => p.name === n), n);
});

test('dl: youtube info parsing with proxy fallback, tiktok, size cap', async () => {
  const dl = require('../lib/dl');
  const calls = [];
  const ok = { status: true, data: { ytdl: { title: 'T', duration: 125, url: 'https://youtu.be/x', thumbnail: 'th', download: 'https://cdn/f.mp3' } } };
  const f1 = async (u) => { calls.push(u); if (calls.length === 1) throw new Error('down'); return { ok: true, json: async () => ok }; };
  const i = await dl.ytInfo('hello world', 'audio', f1);
  assert.equal(i.download, 'https://cdn/f.mp3'); assert.equal(calls.length, 2); assert.ok(calls[1].includes('tube-grab-beta') && calls[0].includes('format=audio'));
  assert.equal(dl.mins(125), '2:05');
  await assert.rejects(dl.ytInfo('x', 'audio', async () => ({ ok: true, json: async () => ({ status: false, message: 'nope' }) })), /nope/);
  const tt = await dl.tiktok('https://vm.tiktok.com/a', async () => ({ ok: true, json: async () => ({ code: 0, data: { title: 'v', play: '/x.mp4', author: { nickname: 'n' } } }) }));
  assert.equal(tt.video, 'https://www.tikwm.com/x.mp4');
  const hdr = (n) => ({ get: () => String(n) });
  assert.equal((await dl.fetchBuffer('u', async () => ({ ok: true, headers: hdr(999999999), arrayBuffer: async () => new ArrayBuffer(1) }))).tooBig, true);
  assert.equal((await dl.fetchBuffer('u', async () => ({ ok: true, headers: hdr(3), arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }))).buffer.length, 3);
  assert.ok(dl.isYouTube('https://youtu.be/abc') && dl.isTikTok('https://www.tiktok.com/@a/video/1'));
  const { loadPlugins } = require('../lib/pluginLoader');
  const ps = loadPlugins(path.join(__dirname, '..', 'plugins'));
  for (const n of ['yt', 'ytget', 'song', 'video', 'tt']) assert.ok(ps.find((p) => p.name === n), n);
});

test('web: weather, translate, wiki, define, convert parsing', async () => {
  const web = require('../lib/web');
  const route = (map) => async (u) => { for (const k of Object.keys(map)) if (u.includes(k)) return { ok: true, json: async () => map[k] }; throw new Error('unrouted ' + u); };
  const w = await web.weather('Lahore', route({
    'geocoding-api': { results: [{ name: 'Lahore', admin1: 'Punjab', country: 'Pakistan', latitude: 31.5, longitude: 74.3 }] },
    'api.open-meteo.com/v1/forecast': { current: { temperature_2m: 24.3, apparent_temperature: 25, relative_humidity_2m: 40, wind_speed_10m: 9, weather_code: 2 }, daily: { time: ['2026-11-15', '2026-11-16'], temperature_2m_max: [28, 29], temperature_2m_min: [15, 16], weather_code: [0, 61] } },
  }));
  assert.equal(w.place, 'Lahore, Punjab, Pakistan'); assert.equal(w.now.text, 'Partly cloudy'); assert.equal(w.days[1].text, 'Light rain');
  await assert.rejects(web.weather('zzz', route({ 'geocoding-api': {} })), /not found/);
  const t = await web.translate('good morning', 'ur', 'auto', route({ 'translate.googleapis': [[['صبح بخیر', 'good morning']], null, 'en'] }));
  assert.equal(t.text, 'صبح بخیر'); assert.equal(t.from, 'en');
  const wk = await web.wiki('x', route({ 'search/title': { pages: [{ key: 'Lahore' }] }, 'page/summary/Lahore': { title: 'Lahore', extract: 'City', content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Lahore' } } } }));
  assert.equal(wk.title, 'Lahore'); assert.ok(wk.url);
  const d = await web.define('hi', route({ dictionaryapi: [{ word: 'hi', phonetic: '/haɪ/', meanings: [{ partOfSpeech: 'interjection', definitions: [{ definition: 'greeting', example: 'hi there' }] }] }] }));
  assert.equal(d.meanings[0].def, 'greeting');
  const c = await web.convert(100, 'usd', 'pkr', route({ 'er-api': { result: 'success', rates: { PKR: 280 } } }));
  assert.equal(c.value, 28000);
  const { loadPlugins } = require('../lib/pluginLoader');
  const ps = loadPlugins(path.join(__dirname, '..', 'plugins'));
  for (const n of ['weather', 'tr', 'wiki', 'define', 'cur']) assert.ok(ps.find((p) => p.name === n), n);
  const sent = []; const ctx = { args: ['ur'], prefix: '.', m: { message: { extendedTextMessage: { contextInfo: { quotedMessage: { conversation: 'hello' } } } } }, config: { botName: 'B' }, reply: async (x) => sent.push(x), sock: {}, jid: 'j' };
  const orig = global.fetch; global.fetch = route({ 'translate.googleapis': [[['ہیلو', 'hello']], null, 'en'] });
  try { await ps.find((p) => p.name === 'tr').handler(ctx); } finally { global.fetch = orig; }
  assert.ok(String(sent[0]).includes('ہیلو'));
});

test('backup: build, validate, restore round trip, traversal rejected', () => {
  const fs = require('fs'), os = require('os');
  const B = require('../lib/backup');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));
  const data = path.join(d, 'data'), ses = path.join(d, 'session');
  fs.mkdirSync(data); fs.mkdirSync(ses);
  fs.writeFileSync(path.join(data, 'channel-forwards.json'), '[{"from":"a"}]');
  fs.writeFileSync(path.join(data, 'warns.json'), '{"g|1":2}');
  fs.writeFileSync(path.join(data, 'cfwd-pending.json'), '[1]');
  fs.writeFileSync(path.join(ses, 'creds.json'), '{"x":1}');
  const small = B.build({ dataDir: data, sessionDir: ses });
  assert.deepEqual(Object.keys(small.files).sort(), ['channel-forwards.json', 'warns.json']);
  assert.equal(small.session, undefined);
  const full = B.build({ dataDir: data, sessionDir: ses, full: true });
  assert.ok(full.session['creds.json']);
  const data2 = path.join(d, 'd2'), ses2 = path.join(d, 's2');
  const r = B.restore(B.parse(Buffer.from(JSON.stringify(full))), { dataDir: data2, sessionDir: ses2 });
  assert.equal(r.data, 2); assert.equal(r.session, 0);
  assert.equal(fs.readFileSync(path.join(data2, 'warns.json'), 'utf8'), '{"g|1":2}');
  const r2 = B.restore(full, { dataDir: data2, sessionDir: ses2, withSession: true });
  assert.equal(r2.session, 1); assert.equal(fs.readFileSync(path.join(ses2, 'creds.json'), 'utf8'), '{"x":1}');
  assert.throws(() => B.validate({ app: 'claudo-md', files: { '../evil.json': '{}' } }), /bad file name/);
  assert.throws(() => B.validate({ app: 'other', files: {} }), /not a Claudo-MD/);
  assert.throws(() => B.validate({ app: 'claudo-md', files: { 'a.json': 'not json' } }));
  assert.ok(/^claudo-backup-\d{8}-\d{4}\.json$/.test(B.fileName(false)));
});

test('backup plugin: backup sends a file, restore reads a replied file', async () => {
  const fs = require('fs'), os = require('os');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bk2-'));
  process.env.FORWARDS_JSON = path.join(d, 'data', 'channel-forwards.json');
  fs.mkdirSync(path.join(d, 'data')); fs.writeFileSync(process.env.FORWARDS_JSON, '[{"from":"z"}]');
  const { loadPlugins } = require('../lib/pluginLoader');
  const ps = loadPlugins(path.join(__dirname, '..', 'plugins'));
  const sent = [], out = [];
  const sock = { sendMessage: async (to, c) => { sent.push([to, c]); } };
  const base = { jid: 'o@s.whatsapp.net', sender: 'o@s.whatsapp.net', prefix: '.', config: { prefix: '.', botName: 'B', ownerNumber: '92300' }, sock, reply: async (x) => out.push(x), group: false, args: [], m: { message: {} } };
  await ps.find((p) => p.name === 'backup').handler({ ...base });
  const doc = sent[0][1];
  assert.ok(doc.document && /claudo-backup/.test(doc.fileName));
  await ps.find((p) => p.name === 'backup').handler({ ...base, group: true, jid: 'g@g.us' });
  assert.equal(sent[sent.length - 1][0], '92300@s.whatsapp.net');
  const media = require('../lib/media');
  const orig = media.download; media.download = async () => doc.document;
  const realExit = process.exit; let exited = 0; process.exit = () => { exited++; };
  try {
    fs.writeFileSync(process.env.FORWARDS_JSON, '[]');
    const m = { key: { remoteJid: 'o@s.whatsapp.net', id: 'X' }, message: { extendedTextMessage: { text: '.restore', contextInfo: { stanzaId: 'Q', quotedMessage: { documentMessage: { fileName: 'b.json' } } } } } };
    await ps.find((p) => p.name === 'restore').handler({ ...base, m });
    assert.equal(fs.readFileSync(process.env.FORWARDS_JSON, 'utf8'), '[{"from":"z"}]');
    await new Promise((r) => setTimeout(r, 1700));
    assert.equal(exited, 1);
  } finally { media.download = orig; process.exit = realExit; }
});

test('fun + stats plugins respond', async () => {
  const { loadPlugins } = require('../lib/pluginLoader');
  const ps = loadPlugins(path.join(__dirname, '..', 'plugins'));
  const out = [];
  const base = { jid: 'a@s.whatsapp.net', sender: 'a@s.whatsapp.net', prefix: '.', startedAt: Date.now(), plugins: ps, config: { prefix: '.', botName: 'B', tagline: 't' }, sock: { sendMessage: async (_, c) => out.push(c) }, reply: async (x) => out.push(x), m: { message: {} } };
  const run = (n, args) => ps.find((p) => p.name === n).handler({ ...base, args, arg: args.join(' ') });
  await run('stats', []); await run('quote', []); await run('8ball', ['will', 'it', 'rain']); await run('choose', ['a', '|', 'b']);
  await run('8ball', []); await run('choose', ['solo']);
  assert.ok(out.length >= 6);
});

test('mini apps: every app file exists, list and send-as-file work', async () => {
  const fs = require('fs');
  const { loadPlugins } = require('../lib/pluginLoader');
  const ps = loadPlugins(path.join(__dirname, '..', 'plugins'));
  const mini = ps.find((p) => p.name === 'mini');
  for (const f of ['calc', 'clock', 'tip', 'units', 'pass', 'bmi', 'age', 'counter', 'dice', 'sci', 'color', 'decide']) {
    const h = fs.readFileSync(path.join(__dirname, '..', 'public', 'mini', f + '.html'), 'utf8');
    assert.ok(h.startsWith('<!doctype html>') && !/https?:\/\//.test(h.replace(/https?:\/\/www\.w3\.org\S*/g, '')), f);
  }
  const out = [];
  const base = { jid: 'a@s.whatsapp.net', sender: 'a@s.whatsapp.net', prefix: '.', config: { prefix: '.', botName: 'B' }, sock: { sendMessage: async (_, c) => out.push(c) }, reply: async (x) => out.push(x), m: { message: {} } };
  await mini.handler({ ...base, args: [] });
  await mini.handler({ ...base, args: ['timer', 'file'] });
  assert.ok(out.some((o) => o && o.document && o.fileName === 'Stopwatch and Timer.html'));
});

test('features: antidelete forwards, anticall rejects, settings toggles', async () => {
  const fs = require('fs'), os = require('os');
  process.env.FORWARDS_JSON = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ft-')), 'channel-forwards.json');
  const settings = require('../lib/settings');
  const F = require('../lib/features');
  const sent = [];
  const sock = { sendMessage: async (to, c) => sent.push([to, c]), rejectCall: async (...a) => sent.push(['reject', a]) };
  const key = { remoteJid: 'g@g.us', id: 'D1', participant: '9211@s.whatsapp.net' };
  const m = { message: { protocolMessage: { type: 0, key } } };
  const store = { getMessage: async () => ({ conversation: 'secret' }) };
  settings.set('antidelete', false);
  assert.equal(await F.onRevoke(sock, m, { ownerNumber: '9230' }, store), false);
  settings.set('antidelete', true);
  assert.equal(await F.onRevoke(sock, m, { ownerNumber: '9230' }, store), true);
  assert.equal(sent[1][0], '9230@s.whatsapp.net'); assert.ok(sent[1][1].forward);
  assert.equal(await F.onRevoke(sock, { message: { protocolMessage: { type: 0, key: { ...key, fromMe: true } } } }, { ownerNumber: '9230' }, store), false);
  settings.set('anticall', true);
  assert.equal(await F.onCall(sock, [{ id: 'c1', from: 'x@s.whatsapp.net', status: 'offer' }, { id: 'c2', from: 'y@s.whatsapp.net', status: 'ringing' }]), 1);
  const { loadPlugins } = require('../lib/pluginLoader');
  const ps = loadPlugins(path.join(__dirname, '..', 'plugins'));
  const out = [];
  const ctx = { jid: 'o@s.whatsapp.net', sender: 'o@s.whatsapp.net', prefix: '.', config: { prefix: '.', botName: 'B' }, sock: { sendMessage: async (_, c) => out.push(c), relayMessage: async () => {} }, reply: async (x) => out.push(x), m: { message: {} } };
  await ps.find((p) => p.name === 'settings').handler({ ...ctx, args: ['mode', 'private'] });
  assert.equal(F.isPrivate(), true);
  await ps.find((p) => p.name === 'settings').handler({ ...ctx, args: ['autoread', 'on'] });
  assert.equal(F.on('autoread'), true);
  await ps.find((p) => p.name === 'settings').handler({ ...ctx, args: ['mode', 'public'] });
  assert.equal(F.isPrivate(), false);
});

test('apk: search parsing, package lookup, plugin sends document or link', async () => {
  const apk = require('../lib/apk');
  const item = (pkg, size) => ({ name: 'App ' + pkg, package: pkg, size, icon: 'https://i/x.png', developer: { name: 'Dev' }, file: { vername: '1.2', path: 'https://pool/x.apk', md5sum: 'abc', malware: { rank: 'TRUSTED' } }, stats: { downloads: 2500000 }, obb: null });
  const fake = async (url) => ({ ok: true, json: async () => ({ datalist: { list: [item('com.a.b', 5e6), item('com.c.d', 300e6), { name: 'nofile', package: 'x.y' }] } }) });
  const r = await apk.search('a', 8, fake);
  assert.equal(r.length, 2); assert.equal(r[0].trusted, true); assert.equal(apk.short(2500000), '2.5M'); assert.equal(apk.mb(5e6), '4.8 MB');
  assert.equal((await apk.byPackage('com.c.d', fake)).pkg, 'com.c.d');
  assert.equal(await apk.byPackage('nope.nope', fake), null);
  const orig = global.fetch; global.fetch = fake;
  try {
    const { loadPlugins } = require('../lib/pluginLoader');
    const ps = loadPlugins(path.join(__dirname, '..', 'plugins'));
    const out = [];
    const ctx = { jid: 'a@s.whatsapp.net', sender: 'a@s.whatsapp.net', prefix: '.', config: { prefix: '.', botName: 'B' }, sock: { sendMessage: async (_, c) => out.push(c), relayMessage: async () => {} }, reply: async (x) => out.push(x), m: { message: {} } };
    await ps.find((p) => p.name === 'apk').handler({ ...ctx, args: ['a'] });
    await ps.find((p) => p.name === 'apkget').handler({ ...ctx, args: ['com.a.b'] });
    assert.ok(out.some((o) => o && o.document && /\.apk$/.test(o.fileName) && o.mimetype.includes('android.package-archive')));
    const before = out.length;
    await ps.find((p) => p.name === 'apkget').handler({ ...ctx, args: ['com.c.d'] });
    assert.ok(out.length > before && !out.slice(before).some((o) => o && o.document));
    await ps.find((p) => p.name === 'apkget').handler({ ...ctx, args: ['../bad'] });
  } finally { global.fetch = orig; }
});
