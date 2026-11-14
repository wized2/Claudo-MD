const botState = require('../lib/botState');
const engine = require('../lib/cfwdEngine');
const settings = require('../lib/settings');
const ui = require('../lib/ui');

const ago = (ms) => { const s = Math.max(0, Math.floor((Date.now() - ms) / 1000)); return s < 90 ? s + 's' : s < 5400 ? Math.round(s / 60) + 'm' : Math.round(s / 3600) + 'h'; };

module.exports = [
  {
    name: 'stop', pattern: 'stop', aliases: ['idle', 'pause'], category: 'owner', owner: true, desc: 'Go idle: all work stops', direct: true,
    async handler(ctx) {
      const changed = botState.setIdle(true, ctx.sender);
      engine.flush();
      await ctx.reply(ui.card('Idle', [changed ? 'All work paused. Only owner controls answer.' : 'Already idle.', '', ui.row('resume', ctx.prefix + 'start')]));
    },
  },
  {
    name: 'start', pattern: 'start', aliases: ['resume', 'wake'], category: 'owner', owner: true, desc: 'Resume; "start fresh" skips missed posts', usage: 'start [fresh]',
    async handler(ctx) {
      const fresh = (ctx.args[0] || '').toLowerCase() === 'fresh';
      if (fresh) engine.skipToNow();
      const changed = botState.setIdle(false, ctx.sender);
      await ctx.reply(ui.card('Running', [changed ? 'Back online.' : 'Already running.', fresh ? 'Posts made while idle were skipped.' : 'Posts missed while idle will be caught up.']));
    },
  },
  {
    name: 'status', pattern: 'status', aliases: ['botstatus'], category: 'owner', owner: true, desc: 'Bot and forward queue status', direct: true,
    async handler(ctx) {
      const st = botState.getState(), e = engine.status();
      const scans = Object.entries(e.scans || {}).map(([j, x]) => ui.item(j.slice(0, 10) + '  ' + ago(x.at) + ' ago  ' + (x.err ? ui.small(x.err) : x.count + ' fetched')));
      await ctx.reply(ui.card('Status', [ui.row('state', st.idle ? 'idle for ' + ago(st.since) : 'running'), ui.row('channels', e.channels), ui.row('queue', e.pending), ui.row('failed', e.failed.length), ...scans, ...e.failed.map((f) => ui.item(f.to + ': ' + f.error))]));
    },
  },
  {
    name: 'ui', pattern: 'ui', category: 'owner', owner: true, desc: 'Switch native buttons or plain text', usage: 'ui native|text',
    async handler(ctx) {
      const v = (ctx.args[0] || '').toLowerCase();
      if (v !== 'native' && v !== 'text') return ctx.reply(ui.row('interface', settings.get('native') === false ? 'text' : 'native') + '\n' + ui.small(ctx.prefix + 'ui native|text'));
      settings.set('native', v === 'native');
      await ctx.reply(ui.row('interface', v));
    },
  },
];
