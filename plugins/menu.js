const native = require('../lib/native');
const ui = require('../lib/ui');

// Order matches the rest of the bot’s categories
const CATS = {
  main: ['Main', 'Everyday basics'],
  islam: ['Islamic', 'Prayer, Quran, hadith, qibla'],
  apps: ['Mini apps', 'Games and offline tools'],
  download: ['Download', 'YouTube, TikTok, APK'],
  info: ['Info', 'Weather, wiki, GitHub, crypto'],
  tools: ['Tools', 'Stickers, QR, text, reminders'],
  group: ['Group', 'Admin tools'],
  forward: ['Forwarding', 'Channel → group relays'],
  owner: ['Owner', 'Control, backup, settings'],
};

const order = (a, b) => {
  const k = Object.keys(CATS);
  const i = k.indexOf(a);
  const j = k.indexOf(b);
  return (i < 0 ? 99 : i) - (j < 0 ? 99 : j);
};

const up = (ms) => {
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  return d ? d + 'd ' + (h % 24) + 'h' : h ? h + 'h ' + (m % 60) + 'm' : m + 'm';
};

function groupPlugins(ctx) {
  const by = {};
  for (const x of ctx.plugins.filter((q) => q.pattern && (!q.owner || ctx.isOwner))) {
    const c = x.category || 'main';
    (by[c] = by[c] || []).push(x);
  }
  for (const k of Object.keys(by)) {
    by[k].sort((a, b) => String(a.pattern).localeCompare(String(b.pattern)));
  }
  return by;
}

function cardLinesForAll(by, cats, p) {
  const lines = [];
  for (const c of cats) {
    const [label] = CATS[c] || [c];
    lines.push(ui.section(label));
    for (const x of by[c]) lines.push(ui.cmd(p, x.pattern, x.desc));
    lines.push('');
  }
  return lines;
}

// Text-first: in text mode the card already lists every command, so send it as is.
// With `.ui native` the same card gets tappable lists/buttons.
function show(kind, ctx, spec) {
  if (!native.enabled()) return ctx.reply(spec.body);
  return native[kind](ctx, spec);
}

module.exports = [
  {
    name: 'menu',
    pattern: 'menu',
    aliases: ['help', 'commands', 'm', 'list'],
    category: 'main',
    desc: 'Browse every command',
    usage: 'menu [category|all]',
    direct: true,
    async handler(ctx) {
      const p = ctx.prefix;
      const want = (ctx.args[0] || '').toLowerCase();
      const by = groupPlugins(ctx);
      const cats = Object.keys(by).sort(order);
      const total = cats.reduce((n, c) => n + by[c].length, 0);
      const name = (ctx.config && ctx.config.botName) || 'Claudo-MD';
      const sub =
        total +
        ' commands · up ' +
        up(Date.now() - (ctx.startedAt || Date.now()));

      // Full dump as card (no need for interactive)
      if (want === 'all') {
        const body = ui.card(name, cardLinesForAll(by, cats, p), {
          sub,
          foot: p + 'usage <cmd> · ' + p + 'find <word>',
        });
        return ctx.reply(body);
      }

      // One category — interactive list of commands + card body
      if (want && by[want]) {
        const [label, blurb] = CATS[want] || [want, ''];
        const cmds = by[want];
        const lines = [
          blurb ? ui.small(blurb) : '',
          '',
          ...cmds.map((x) => ui.cmd(p, x.pattern, x.desc)),
        ].filter((l) => l !== undefined);
        const body = ui.card(label, lines, {
          sub: cmds.length + ' commands',
          foot: p + 'menu',
        });
        const rows = cmds.slice(0, 10).map((x) => ({
          id: x.direct ? p + x.pattern : p + 'usage ' + x.pattern,
          title: p + x.pattern,
          description: (x.desc || '').slice(0, 72),
        }));
        return show('list', ctx, {
          title: label,
          body,
          footer: name,
          button: 'Open',
          sections: [{ title: label.slice(0, 24), rows }],
        });
      }

      // Main menu — interactive category picker (bot UI card + native list)
      const overview = cats.map((c) => {
        const [label] = CATS[c] || [c];
        return ui.cmd(p, 'menu ' + c, label + '  ' + by[c].length);
      });
      const body = ui.card(name, [
        ui.small(sub),
        '',
        ...overview,
        '',
        ui.small(p + 'menu <category> · ' + p + 'menu all · ' + p + 'find <word>'),
      ], { foot: false });

      const rows = cats.slice(0, 10).map((c) => ({
        id: p + 'menu ' + c,
        title: (CATS[c] || [c])[0],
        description: ((CATS[c] || ['', ''])[1] || by[c].length + ' commands').slice(0, 72),
      }));

      // Prefer interactive list; native.list falls back to card text automatically
      await show('list', ctx, {
        title: name,
        body,
        footer: name,
        button: 'Sections',
        sections: [{ title: 'Menu', rows }],
      });

      // Quick-reply shortcuts, only with native buttons on
      if (!native.enabled()) return;
      try {
        await show('buttons', ctx, {
          title: name,
          body: ui.card('Shortcuts', [
            ui.small('Jump without opening the list'),
          ], { foot: false }),
          footer: name,
          buttons: [
            { id: p + 'menu all', text: 'All cmds' },
            { id: p + 'find', text: 'Find' },
            { id: p + 'status', text: 'Status' },
          ].slice(0, 3),
        });
      } catch (_) {}
    },
  },
  {
    name: 'usage',
    pattern: 'usage',
    aliases: ['how', 'man'],
    category: 'main',
    desc: 'How to use a command',
    usage: 'usage <command>',
    async handler(ctx) {
      const q = (ctx.args[0] || '').toLowerCase().replace(/^\./, '');
      if (!q) {
        return show('buttons', ctx, {
          title: 'Usage',
          body: ui.card('Usage', [ui.cmd(ctx.prefix, 'usage calc'), ui.small('Show help for any command')], { foot: false }),
          footer: ctx.config.botName,
          buttons: [
            { id: ctx.prefix + 'menu', text: 'Menu' },
            { id: ctx.prefix + 'find', text: 'Find' },
          ],
        });
      }
      const x = ctx.plugins.find(
        (pl) =>
          pl.pattern === q ||
          (pl.aliases || []).map((a) => String(a).toLowerCase()).includes(q)
      );
      if (!x) {
        return ctx.reply(ui.note('Unknown command. Try ' + ctx.prefix + 'menu'));
      }
      const lines = [
        ui.row('command', ctx.prefix + x.pattern),
        x.desc ? ui.small(x.desc) : '',
        ui.row('usage', ctx.prefix + (x.usage || x.pattern)),
        x.aliases && x.aliases.length
          ? ui.row('aliases', x.aliases.map((a) => ctx.prefix + a).join('  '))
          : '',
        x.owner ? ui.row('access', 'owner only') : '',
        x.group ? ui.row('where', 'groups only') : '',
      ].filter(Boolean);
      const body = ui.card(ctx.prefix + x.pattern, lines, { foot: ctx.prefix + 'menu' });
      return show('buttons', ctx, {
        title: ctx.prefix + x.pattern,
        body,
        footer: ctx.config.botName,
        buttons: [
          { id: ctx.prefix + 'menu', text: 'Menu' },
          x.direct ? { id: ctx.prefix + x.pattern, text: 'Run' } : { id: ctx.prefix + 'menu ' + (x.category || 'main'), text: 'Category' },
        ].filter(Boolean).slice(0, 3),
      });
    },
  },
  {
    name: 'find',
    pattern: 'find',
    aliases: ['search', 'cmd'],
    category: 'main',
    desc: 'Find a command by word',
    usage: 'find <word>',
    async handler(ctx) {
      const q = ctx.args.join(' ').toLowerCase().trim();
      if (!q) {
        return show('buttons', ctx, {
          title: 'Find',
          body: ui.card('Find', [ui.cmd(ctx.prefix, 'find download'), ui.small('Search commands by word')], { foot: false }),
          footer: ctx.config.botName,
          buttons: [{ id: ctx.prefix + 'menu', text: 'Menu' }],
        });
      }
      const hits = ctx.plugins
        .filter(
          (x) =>
            x.pattern &&
            (!x.owner || ctx.isOwner) &&
            [x.pattern, ...(x.aliases || []), x.desc || '', x.category || '']
              .join(' ')
              .toLowerCase()
              .includes(q)
        )
        .slice(0, 12);
      if (!hits.length) return ctx.reply(ui.note('Nothing matches "' + q + '"'));
      const lines = hits.map((x) => ui.cmd(ctx.prefix, x.pattern, x.desc));
      const body = ui.card('Find', lines, { sub: hits.length + ' for "' + q + '"', foot: ctx.prefix + 'menu' });
      const rows = hits.slice(0, 10).map((x) => ({
        id: x.direct ? ctx.prefix + x.pattern : ctx.prefix + 'usage ' + x.pattern,
        title: ctx.prefix + x.pattern,
        description: (x.desc || '').slice(0, 72),
      }));
      return show('list', ctx, {
        title: 'Find',
        body,
        footer: ctx.config.botName,
        button: 'Open',
        sections: [{ title: 'Matches', rows }],
      });
    },
  },
];
