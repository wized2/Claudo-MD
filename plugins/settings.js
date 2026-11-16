const native = require('../lib/native');
const ui = require('../lib/ui');
const settings = require('../lib/settings');
const F = require('../lib/features');

const yes = (v) => /^(on|yes|true|1|enable)$/i.test(v);
const no = (v) => /^(off|no|false|0|disable)$/i.test(v);

module.exports = [
  {
    name: 'settings', pattern: 'settings', aliases: ['setting', 'config'], category: 'owner', owner: true, desc: 'Toggle bot features', usage: 'settings [feature on|off]', direct: true,
    async handler(ctx) {
      const p = ctx.prefix; const key = (ctx.args[0] || '').toLowerCase(); const val = (ctx.args[1] || '').toLowerCase();
      if (F.FLAGS[key] && (yes(val) || no(val))) settings.set(key, yes(val));
      if (key === 'mode' && (val === 'private' || val === 'public')) settings.set('mode', val);
      const rows = [{ id: p + 'settings mode ' + (F.isPrivate() ? 'public' : 'private'), title: 'Mode: ' + (F.isPrivate() ? 'private' : 'public'), description: F.isPrivate() ? 'Only you can use commands. Tap for public' : 'Everyone can use commands. Tap for private' }];
      const lines = [ui.row('mode', F.isPrivate() ? 'private' : 'public')];
      for (const [k, [t, d]] of Object.entries(F.FLAGS)) {
        const cur = F.on(k);
        rows.push({ id: p + 'settings ' + k + ' ' + (cur ? 'off' : 'on'), title: t + ': ' + (cur ? 'ON' : 'off'), description: d + '. Tap to turn ' + (cur ? 'off' : 'on') });
        lines.push(ui.row(t.toLowerCase(), cur ? 'on' : 'off'));
      }
      const hrs = Number(settings.get('autobackup') || 0);
      lines.push(ui.row('auto backup', hrs ? 'every ' + hrs + ' h' : 'off'), '', ui.small('Tap Change to flip a setting'));
      await native.list(ctx, { title: 'Settings', body: ui.card('Settings', lines, { foot: false }), footer: ctx.config.botName, button: 'Change', sections: [{ title: 'Features', rows }] });
    },
  },
];
