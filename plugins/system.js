const native = require('../lib/native');
const ui = require('../lib/ui');

function fmt(ms) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + m + 'm ' + (s % 60) + 's';
}

module.exports = [
  {
    name: 'ping', pattern: 'ping', aliases: ['p'], category: 'main', desc: 'Latency check', direct: true,
    async handler(ctx) {
      const t0 = Date.now();
      await ctx.reply(ui.card('Pong', [ui.row('latency', Date.now() - t0 + ' ms'), ui.row('uptime', fmt(Date.now() - ctx.startedAt))]));
    },
  },
  {
    name: 'alive', pattern: 'alive', aliases: ['bot'], category: 'main', desc: 'Bot status card', direct: true,
    async handler(ctx) {
      const p = ctx.prefix;
      await native.buttons(ctx, {
        title: ctx.config.botName,
        body: ui.card('Online', [ui.row('uptime', fmt(Date.now() - ctx.startedAt)), ui.row('prefix', p), ui.row('plugins', ctx.plugins.length)], { foot: false }),
        footer: ctx.config.tagline,
        buttons: [{ id: p + 'menu', text: 'Menu' }, { id: p + 'ping', text: 'Ping' }, { id: p + 'apps', text: 'Mini apps' }],
      });
    },
  },
  {
    name: 'id', pattern: 'id', aliases: ['jid'], category: 'main', desc: 'Chat id and your id', direct: true,
    async handler(ctx) {
      await ctx.reply(ui.card('Identity', [ui.row('chat', ctx.jid), ui.row('you', ctx.sender)]));
    },
  },
];
