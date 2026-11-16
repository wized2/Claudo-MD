const ui = require('../lib/ui');
const settings = require('../lib/settings');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = [
  {
    name: 'prefix', pattern: 'prefix', category: 'owner', owner: true, desc: 'Show or change the command prefix', usage: 'prefix [new]', direct: true,
    async handler(ctx) {
      const v = (ctx.args[0] || '').trim();
      if (!v) return ctx.reply(ui.row('prefix', ctx.config.prefix));
      if (v.length > 3 || /[\s\w]/.test(v)) return ctx.reply(ui.note('use 1 to 3 symbols, like . ! # /'));
      settings.set('prefix', v); ctx.config.prefix = v;
      await ctx.reply(ui.card('Prefix', [ui.row('now', v), ui.note('commands now start with ' + v)], { foot: false }));
    },
  },
  {
    name: 'restart', pattern: 'restart', aliases: ['reboot'], category: 'owner', owner: true, desc: 'Restart the bot process', direct: false,
    async handler(ctx) { await ctx.reply(ui.note('restarting, back in a moment')); setTimeout(() => process.exit(0), 1200); },
  },
  {
    name: 'broadcast', pattern: 'broadcast', aliases: ['bc'], category: 'owner', owner: true, desc: 'Send a message to all groups (slowly)', usage: 'broadcast <text>',
    async handler(ctx) {
      const t = ctx.args.join(' ').trim();
      if (!t) return ctx.reply(ui.card('Broadcast', [ui.cmd(ctx.prefix, 'broadcast Server maintenance tonight'), ui.note('one group every 4 seconds, max 50')], { foot: false }));
      const all = Object.keys(await ctx.sock.groupFetchAllParticipating()).slice(0, 50);
      await ctx.reply(ui.row('sending to', all.length + ' groups'));
      let ok = 0;
      for (const g of all) { try { await ctx.sock.sendMessage(g, { text: ui.card('Announcement', [t], { foot: false }) }); ok++; } catch (e) { /* skip */ } await sleep(ctx.pause === 0 ? 0 : 4000); }
      await ctx.reply(ui.row('delivered', ok + ' / ' + all.length));
    },
  },
];
