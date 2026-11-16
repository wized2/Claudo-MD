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
  {
    name: 'goodbye', pattern: 'goodbye', aliases: ['bye'], category: 'group', group: true, desc: 'Say goodbye when someone leaves: on or off', usage: 'goodbye on|off',
    async handler(ctx) {
      const g2 = await guard(ctx, { needBot: false }); if (!g2) return;
      const v = (ctx.args[0] || '').toLowerCase();
      if (v === 'on' || v === 'off') { P.setCfg(ctx.jid, { goodbye: v === 'on' }); return ctx.reply(ui.row('goodbye', v)); }
      await native.buttons(ctx, { title: 'Goodbye', body: ui.card('Goodbye', [ui.row('status', P.getCfg(ctx.jid).goodbye ? 'on' : 'off')], { foot: false }), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'goodbye on', text: 'Turn on' }, { id: ctx.prefix + 'goodbye off', text: 'Turn off' }] });
    },
  },
  {
    name: 'antispam', pattern: 'antispam', category: 'group', group: true, desc: 'Stop message flooding: off, warn, kick', usage: 'antispam off|warn|kick',
    async handler(ctx) {
      const g2 = await guard(ctx, { needBot: false }); if (!g2) return;
      const v = (ctx.args[0] || '').toLowerCase();
      if (['off', 'warn', 'kick'].includes(v)) { P.setCfg(ctx.jid, { antispam: v }); return ctx.reply(ui.card('Anti spam', [ui.row('mode', v), v !== 'off' && !g2.botAdmin ? ui.note('make the bot an admin so it can act') : '', ui.note('limit: 6 messages in 8 seconds, admins are exempt')].filter(Boolean), { foot: false })); }
      await native.buttons(ctx, { title: 'Anti spam', body: ui.card('Anti spam', [ui.row('mode', P.getCfg(ctx.jid).antispam), ui.note('6 messages in 8 seconds. warn deletes the extra ones, kick removes after 3 strikes')], { foot: false }), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'antispam warn', text: 'Warn' }, { id: ctx.prefix + 'antispam kick', text: 'Kick' }, { id: ctx.prefix + 'antispam off', text: 'Off' }] });
    },
  },
];
