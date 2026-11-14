const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfwd-'));
process.env.FORWARDS_JSON = path.join(dir, 'channel-forwards.json');
const cf = require('../lib/forward');
const engine = require('../lib/cfwdEngine');
const botState = require('../lib/botState');
const nf = require('../lib/newsletterFetch');

const CH = '120363000000000001@newsletter';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const GRP = '120363999999999999@g.us';

function fakeSock() {
  const sent = [];
  return {
    sent,
    fail: 0,
    async sendMessage(to, content) {
      if (this.fail > 0) { this.fail--; throw new Error('boom'); }
      sent.push({ to, content });
      return { key: { id: 'x' } };
    },
    async newsletterMetadata() { return { thread_metadata: { name: { text: 'My Channel' } } }; },
  };
}
const post = (id, text, sid) => ({ key: { remoteJid: CH, id, server_id: sid, fromMe: false }, message: { conversation: text }, messageTimestamp: Math.floor(Date.now() / 1000) });

async function setup(rule) {
  await wait(1300); // let loops from the previous test finish
  engine._reset();
  botState._resetForTests();
  for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  cf.saveRules([{ from: CH, to: GRP, enabled: true, ...rule }]);
}

test('classic text forwards once, duplicate ids/fingerprint ignored', async () => {
  await setup({});
  const s = fakeSock();
  assert.equal(await engine.handleMessage(s, post('a1', 'hello', '10'), {}), true);
  await wait(50);
  assert.equal(await engine.handleMessage(s, post('a1', 'hello', '10'), {}), false);
  assert.equal(await engine.handleMessage(s, post('zz', 'hello', '99'), {}), false); // same content, other id
  await engine.processQueue(s);
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].content.text, 'hello');
});

test('failed send stays queued and is retried', async () => {
  await setup({});
  const s = fakeSock();
  s.fail = 3;
  await engine.handleMessage(s, post('b1', 'retry me', '11'), {});
  for (let i = 0; i < 80 && !(engine._pending()[0] && engine._pending()[0].attempts >= 1); i++) await wait(100);
  assert.equal(engine._pending().length, 1);
  assert.equal(s.sent.length, 0);
  await wait(1500);
  engine._pending()[0].next = 0;
  await engine.processQueue(s);
  assert.equal(s.sent.length, 1);
  assert.equal(engine._pending().length, 0);
});

test('ocfwd text carries native channel context', async () => {
  await setup({ mode: 'ocfwd', nativeForward: true });
  const s = fakeSock();
  await engine.handleMessage(s, post('c1', 'native', '4242'), {});
  await wait(100);
  await engine.processQueue(s);
  const ci = s.sent[0].content.contextInfo;
  assert.equal(ci.isForwarded, true);
  assert.equal(ci.forwardedNewsletterMessageInfo.newsletterJid, CH);
  assert.equal(ci.forwardedNewsletterMessageInfo.serverMessageId, 4242);
  assert.equal(ci.forwardedNewsletterMessageInfo.newsletterName, 'My Channel');
});

test('idle mode drops live posts and keeps cursor so scan can look back', async () => {
  await setup({});
  const s = fakeSock();
  botState.setIdle(true, 'test');
  assert.equal(await engine.handleMessage(s, post('d1', 'while idle', '12'), {}), false);
  botState.setIdle(false, 'test');
  assert.equal(await engine.handleMessage(s, post('d1', 'while idle', '12'), {}), true);
});

test('scan backfills missed posts from fetch result', async () => {
  await setup({});
  const s = fakeSock();
  s.newsletterFetchMessages = async () => ({ tag: 'iq', content: [{ tag: 'messages', content: [
    { tag: 'message', attrs: { message_id: 'e1', server_id: '77', t: String(Math.floor(Date.now() / 1000)) },
      content: [{ tag: 'plaintext', content: Buffer.from(require('baileys').proto.Message.encode({ conversation: 'missed one' }).finish()) }] },
  ] }] });
  const n = await engine.scan(s, {});
  assert.equal(n, 1);
  await engine.processQueue(s);
  assert.equal(s.sent[0].content.text, 'missed one');
});

test('parseFetchResult ids and server id', () => {
  const m = nf.nodeToMessage(CH, { tag: 'message', attrs: { id: '5', server_id: '5' }, content: [{ tag: 'plaintext', content: Buffer.from(require('baileys').proto.Message.encode({ conversation: 'x' }).finish()) }] });
  assert.equal(m.message.conversation, 'x');
  assert.equal(nf.findServerId(m), 5);
});

test('plugins load and menu/ui/detect work', () => {
  const { loadPlugins, matchPlugin } = require('../lib/pluginLoader');
  const plugins = loadPlugins(path.join(__dirname, '..', 'plugins'));
  assert.ok(plugins.length >= 10);
  const hit = matchPlugin(plugins, '.menu group', '.');
  assert.equal(hit.plugin.name, 'menu');
  assert.deepEqual(hit.args, ['group']);
  const ui = require('../lib/ui');
  assert.ok(ui.card('x', ['y']).includes('𝗫'));
  const d = require('../lib/detect');
  assert.equal(d.analyze('Join our channel https://whatsapp.com/channel/abc').spam, true);
  assert.equal(d.analyze('Budget approved by cabinet today').spam, false);
});
