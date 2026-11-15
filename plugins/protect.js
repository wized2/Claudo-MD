const native = require('../lib/native');
const ui = require('../lib/ui');
const P = require('../lib/protect');
const { guard } = require('../lib/groupTools');

module.exports = [
  {
    name: 'antilink', pattern: 'antilink', category: 'group', group: true, desc: 'Delete links: off, warn, kick', usage: 'antilink off|warn|kick',
    async handler(ctx) {
      const g = await guard(ctx, { needBot: false }); if (!g) return;
      const p = ctx.prefix; const v = (ctx.args[0] || '').toLowerCase();
      if (['off', 'warn', 'kick'].includes(v)) { P.setCfg(ctx.jid, { antilink: v }); return ctx.reply(ui.card('Anti link', [ui.row('mode', v), v !== 'off' && !g.botAdmin ? ui.small('make the bot an admin so it can delete') : ''].filter(Boolean), { foot: false })); }
      const cur = P.getCfg(ctx.jid).antilink;
      await native.buttons(ctx, { title: 'Anti link', body: ui.card('Anti link', [ui.row('mode', cur), ui.small('Admins are never affected')], { foot: false }), footer: ctx.config.botName, buttons: [{ id: p + 'antilink warn', text: 'Delete + warn' }, { id: p + 'antilink kick', text: 'Delete + kick' }, { id: p + 'antilink off', text: 'Off' }] });
    },
  },
  {
    name: 'welcome', pattern: 'welcome', category: 'group', group: true, desc: 'Greet new members: on or off', usage: 'welcome on|off',
    async handler(ctx) {
      const g = await guard(ctx, { needBot: false }); if (!g) return;
      const v = (ctx.args[0] || '').toLowerCase(); const p = ctx.prefix;
      if (v === 'on' || v === 'off') { P.setCfg(ctx.jid, { welcome: v === 'on' }); return ctx.reply(ui.row('welcome', v)); }
      await native.buttons(ctx, { title: 'Welcome', body: ui.card('Welcome', [ui.row('status', P.getCfg(ctx.jid).welcome ? 'on' : 'off')], { foot: false }), footer: ctx.config.botName, buttons: [{ id: p + 'welcome on', text: 'On' }, { id: p + 'welcome off', text: 'Off' }] });
    },
  },
];
