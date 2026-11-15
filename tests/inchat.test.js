const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

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
