const native = require('../lib/native');
const ui = require('../lib/ui');
const settings = require('../lib/settings');

// Order here is the order shown in the menu.
const CATS = {
  main: ['Main', 'Everyday basics'],
  islam: ['Islamic', 'Prayer times, Quran, hadith, qibla'],
  apps: ['Mini apps', 'Games and offline tools'],
  download: ['Download', 'YouTube, TikTok and APK'],
  info: ['Info', 'Weather, wiki, GitHub, crypto, Pokedex'],
  tools: ['Tools', 'Stickers, QR, text and reminders'],
  group: ['Group', 'Admin tools for groups'],
  forward: ['Forwarding', 'Channel to group relays'],
  owner: ['Owner', 'Control, backup and settings'],
};
const order = (a, b) => { const k = Object.keys(CATS); const i = k.indexOf(a), j = k.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); };
const up = (ms) => { const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24); return d ? d + 'd ' + (h % 24) + 'h' : h ? h + 'h ' + (m % 60) + 'm' : m + 'm'; };

function group(ctx) {
  const by = {};
  for (const x of ctx.plugins.filter((q) => q.pattern && (!q.owner || ctx.isOwner))) (by[x.category || 'main'] = by[x.category || 'main'] || []).push(x);
  for (const k of Object.keys(by)) by[k].sort((a, b) => a.pattern.localeCompare(b.pattern));
  return by;
}

module.exports = [
  {
    name: 'menu', pattern: 'menu', aliases: ['help', 'commands', 'm'], category: 'main', desc: 'Browse every command', usage: 'menu [category|all]', direct: true,
    async handler(ctx) {
      const p = ctx.prefix; const want = (ctx.args[0] || '').toLowerCase();
      const by = group(ctx); const cats = Object.keys(by).sort(order);
      const total = cats.reduce((n, c) => n + by[c].length, 0);

      if (want === 'all') {
        const lines = [];
        for (const c of cats) { lines.push(ui.section((CATS[c] || [c])[0]), ...by[c].map((x) => ui.cmd(p, x.pattern, x.desc)), ''); }
        return ctx.reply(ui.card(ctx.config.botName, lines, { sub: total + ' commands', foot: 'use ' + p + 'usage <command> for details' }));
      }
      if (want && by[want]) {
        const [label, blurb] = CATS[want] || [want, ''];
        const rows = by[want].slice(0, 10).map((x) => ({ id: x.direct ? p + x.pattern : p + 'usage ' + x.pattern, title: p + x.pattern, description: x.desc || '' }));
        const lines = by[want].map((x) => ui.cmd(p, x.pattern, x.desc));
        if (by[want].length > 10) lines.push('', ui.note('showing the first 10 as buttons, all are listed above'));
        return native.list(ctx, { title: label, body: ui.card(label, lines, { sub: blurb + '  ·  ' + by[want].length, foot: p + 'menu to go back' }), footer: ctx.config.botName, button: 'Run a command', sections: [{ title: label, rows }] });
      }

      const who = (ctx.m && ctx.m.pushName) || 'friend';
      const lines = [
        ui.section('Status'),
        ui.row('hello', who),
        ui.row('prefix', p),
        ui.row('uptime', up(Date.now() - (ctx.startedAt || Date.now()))),
        ui.row('commands', total),
        ui.row('mode', settings.get('mode') === 'private' ? 'private' : 'public'),
        '',
        ui.section('Categories'),
        ...cats.map((c) => ui.cmd(p, 'menu ' + c, (CATS[c] || [c])[0] + '  ' + by[c].length)),
        '',
        ui.note('full list: ' + p + 'menu all'),
      ];
      const rows = cats.map((c) => ({ id: p + 'menu ' + c, title: (CATS[c] || [c])[0], description: ((CATS[c] || [])[1] || '') + ' (' + by[c].length + ')' }));
      await native.list(ctx, { title: ctx.config.botName, body: ui.card(ctx.config.botName, lines, { sub: ctx.config.tagline, foot: 'pick a category' }), footer: 'Pick a category', button: 'Categories', sections: [{ title: 'Categories', rows }] });
    },
  },
  {
    name: 'usage', pattern: 'usage', category: 'main', desc: 'Show how a command works', usage: 'usage <command>',
    async handler(ctx) {
      const name = (ctx.args[0] || '').toLowerCase().replace(/^[^a-z0-9]+/, '');
      const x = ctx.plugins.find((q) => q.pattern === name || (q.aliases || []).includes(name));
      if (!x) return ctx.reply(ui.note('unknown command, try ' + ctx.prefix + 'menu all'));
      await ctx.reply(ui.card(ctx.prefix + x.pattern, [x.desc || '', '', ui.row('usage', ctx.prefix + (x.usage || x.pattern)), x.aliases && x.aliases.length ? ui.row('aliases', x.aliases.map((a) => ctx.prefix + a).join('  ')) : '', x.owner ? ui.row('access', 'owner only') : '', x.group ? ui.row('where', 'groups only') : ''].filter((l) => l !== ''), { foot: ctx.prefix + 'menu' }));
    },
  },
  {
    name: 'find', pattern: 'find', aliases: ['search', 'cmd'], category: 'main', desc: 'Find a command by word', usage: 'find <word>',
    async handler(ctx) {
      const q = ctx.args.join(' ').toLowerCase().trim();
      if (!q) return ctx.reply(ui.card('Find', [ui.cmd(ctx.prefix, 'find download')], { foot: false }));
      const hits = ctx.plugins.filter((x) => x.pattern && (!x.owner || ctx.isOwner) && [x.pattern, ...(x.aliases || []), x.desc || '', x.category || ''].join(' ').toLowerCase().includes(q)).slice(0, 12);
      if (!hits.length) return ctx.reply(ui.note('nothing matches "' + q + '"'));
      const rows = hits.slice(0, 10).map((x) => ({ id: x.direct ? ctx.prefix + x.pattern : ctx.prefix + 'usage ' + x.pattern, title: ctx.prefix + x.pattern, description: x.desc || '' }));
      await native.list(ctx, { title: 'Find', body: ui.card('Find', hits.map((x) => ui.cmd(ctx.prefix, x.pattern, x.desc)), { sub: hits.length + ' for "' + q + '"', foot: false }), footer: ctx.config.botName, button: 'Open', sections: [{ title: 'Matches', rows }] });
    },
  },
];
