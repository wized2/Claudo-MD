const native = require('../lib/native');
const ui = require('../lib/ui');

const CATS = {
  main: ['Main', 'Everyday basics'],
  islam: ['Islamic', 'Prayer times, Quran, hadith, qibla, tasbih'],
  apps: ['Mini apps', 'Interactive tools and games'],
  forward: ['Forwarding', 'Channel to group and channel relays'],
  group: ['Group', 'Admin tools for groups'],
  download: ['Download', 'YouTube, TikTok and APK'],
  info: ['Info', 'Weather, translate, wiki, GitHub, crypto, Pokedex'],
  tools: ['Tools', 'Utilities'],
  owner: ['Owner', 'Control and settings'],
};

module.exports = [
  {
    name: 'menu', pattern: 'menu', aliases: ['help', 'commands', 'm'], category: 'main', desc: 'Browse every command', direct: true,
    async handler(ctx) {
      const p = ctx.prefix;
      const want = (ctx.args[0] || '').toLowerCase();
      const visible = ctx.plugins.filter((x) => x.pattern && (!x.owner || ctx.isOwner));
      const byCat = {};
      for (const x of visible) (byCat[x.category] = byCat[x.category] || []).push(x);

      if (want && byCat[want]) {
        const [label] = CATS[want] || [want];
        const rows = byCat[want].map((x) => ({ id: x.direct ? p + x.pattern : p + 'usage ' + x.pattern, title: p + x.pattern, description: x.desc || '' }));
        const lines = byCat[want].map((x) => ui.cmd(p, x.pattern, x.desc));
        return native.list(ctx, { title: label, body: ui.card(label, lines, { foot: false }), footer: ctx.config.botName, button: 'Run a command', sections: [{ title: label, rows }] });
      }

      const rows = Object.keys(byCat).map((c) => ({ id: p + 'menu ' + c, title: (CATS[c] || [c])[0], description: ((CATS[c] || [])[1] || '') + ' (' + byCat[c].length + ')' }));
      const body = ui.card(ctx.config.botName, [ui.small(ctx.config.tagline), '', ...Object.keys(byCat).map((c) => ui.item(ui.bold((CATS[c] || [c])[0]) + '  ' + ui.small(byCat[c].length + ' commands')))], { foot: false });
      await native.list(ctx, { title: ctx.config.botName, body, footer: 'Pick a category', button: 'Categories', sections: [{ title: 'Categories', rows }] });
    },
  },
  {
    name: 'usage', pattern: 'usage', category: 'main', desc: 'Show how a command works',
    async handler(ctx) {
      const name = (ctx.args[0] || '').toLowerCase();
      const x = ctx.plugins.find((q) => q.pattern === name || (q.aliases || []).includes(name));
      if (!x) return ctx.reply(ui.small('unknown command'));
      await ctx.reply(ui.card(ctx.prefix + x.pattern, [x.desc || '', '', ui.row('usage', ctx.prefix + (x.usage || x.pattern)), x.aliases && x.aliases.length ? ui.row('aliases', x.aliases.join(', ')) : ''].filter((l) => l !== '')));
    },
  },
];
