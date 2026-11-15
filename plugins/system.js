const native = require('../lib/native');
const ui = require('../lib/ui');
const os = require('os');

function fmt(ms) {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + m + 'm ' + (s % 60) + 's';
}

function fmtBytes(b) {
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1024).toFixed(1) + ' KB';
}

module.exports = [
  {
    name: 'ping', pattern: 'ping', aliases: ['p'], category: 'main', desc: 'Latency check', direct: true,
    async handler(ctx) {
      const t0 = Date.now();
      const sent = await ctx.reply(ui.card('Pong', [ui.row('uptime', fmt(Date.now() - ctx.startedAt))]));
      const latency = Date.now() - t0;
      // Edit-style re-send with real latency (Baileys does not support edits on all clients, so we re-reply)
      await ctx.reply(ui.card('Pong', [ui.row('latency', latency + ' ms'), ui.row('uptime', fmt(Date.now() - ctx.startedAt))]));
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
        buttons: [{ id: p + 'menu', text: 'Menu' }, { id: p + 'ping', text: 'Ping' }, { id: p + 'stats', text: 'Stats' }],
      });
    },
  },
  {
    name: 'id', pattern: 'id', aliases: ['jid'], category: 'main', desc: 'Chat id and your id', direct: true,
    async handler(ctx) {
      await ctx.reply(ui.card('Identity', [ui.row('chat', ctx.jid), ui.row('you', ctx.sender)]));
    },
  },
  {
    name: 'stats', pattern: 'stats', aliases: ['system', 'sysinfo'], category: 'main', desc: 'System resource usage', direct: true,
    async handler(ctx) {
      const mem = process.memoryUsage();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const cpus = os.cpus();
      const cpuModel = cpus[0] ? cpus[0].model.trim().slice(0, 30) : 'Unknown';
      const loadAvg = os.loadavg().map((l) => l.toFixed(2)).join(' / ');
      const nodeVer = process.version;
      const platform = os.platform() + ' ' + os.arch();

      const lines = [
        ui.section('Process'),
        ui.row('heap used', fmtBytes(mem.heapUsed)),
        ui.row('heap total', fmtBytes(mem.heapTotal)),
        ui.row('rss', fmtBytes(mem.rss)),
        ui.row('uptime', fmt(Date.now() - ctx.startedAt)),
        ui.section('System'),
        ui.row('ram used', fmtBytes(usedMem) + ' / ' + fmtBytes(totalMem)),
        ui.row('ram free', fmtBytes(freeMem)),
        ui.row('load avg', loadAvg),
        ui.row('cpu', cpuModel),
        ui.row('platform', platform),
        ui.row('node', nodeVer),
      ];
      await ctx.reply(ui.card('System stats', lines, { foot: false }));
    },
  },
];
