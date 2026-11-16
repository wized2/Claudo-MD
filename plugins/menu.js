const ui = require('../lib/ui');

// Display order for categories
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
  for (const k of Object.keys(by)) by[k].sort((a, b) => String(a.pattern).localeCompare(String(b.pattern)));
  return by;
}

/** Always-works plain text menu (MiniBot-style). */
function textMenu(ctx, by, cats, total) {
  const p = ctx.prefix;
  const name = (ctx.config && ctx.config.botName) || 'Claudo-MD';
  const lines = [
    '*' + name + '*',
    total + ' commands · uptime ' + up(Date.now() - (ctx.startedAt || Date.now())),
    '',
  ];
  for (const c of cats) {
    const [label] = CATS[c] || [c];
    lines.push('*' + label + '*');
    for (const x of by[c]) {
      lines.push(p + x.pattern + (x.desc ? ' — ' + x.desc : ''));
    }
    lines.push('');
  }
  lines.push('_' + p + 'menu <category>_ · _' + p + 'menu all_ · _' + p + 'usage <cmd>_ · _' + p + 'find <word>_');
  return lines.join('\n').trim();
}

function textCategory(ctx, by, cat) {
  const p = ctx.prefix;
  const [label, blurb] = CATS[cat] || [cat, ''];
  const lines = ['*' + label + '*'];
  if (blurb) lines.push(blurb, '');
  for (const x of by[cat] || []) {
    lines.push(p + x.pattern + (x.desc ? ' — ' + x.desc : ''));
  }
  lines.push('', '_' + p + 'menu_ to go back');
  return lines.join('\n');
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
      const want = (ctx.args[0] || '').toLowerCase();
      const by = groupPlugins(ctx);
      const cats = Object.keys(by).sort(order);
      const total = cats.reduce((n, c) => n + by[c].length, 0);

      if (want === 'all') {
        return ctx.reply(textMenu(ctx, by, cats, total));
      }
      if (want && by[want]) {
        return ctx.reply(textCategory(ctx, by, want));
      }
      // Main menu — plain text only (reliable on all accounts)
      return ctx.reply(textMenu(ctx, by, cats, total));
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
      if (!q) return ctx.reply('Usage: ' + ctx.prefix + 'usage <command>\nExample: ' + ctx.prefix + 'usage calc');
      const x = ctx.plugins.find(
        (pl) =>
          pl.pattern === q ||
          (pl.aliases || []).map((a) => String(a).toLowerCase()).includes(q)
      );
      if (!x) return ctx.reply('Unknown command. Try ' + ctx.prefix + 'menu');
      const lines = [
        '*' + ctx.prefix + x.pattern + '*',
        x.desc || '',
        '',
        'Usage: ' + ctx.prefix + (x.usage || x.pattern),
      ];
      if (x.aliases && x.aliases.length) lines.push('Aliases: ' + x.aliases.map((a) => ctx.prefix + a).join(', '));
      if (x.owner) lines.push('Access: owner only');
      if (x.group) lines.push('Where: groups only');
      lines.push('', ctx.prefix + 'menu');
      await ctx.reply(lines.filter(Boolean).join('\n'));
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
      if (!q) return ctx.reply('Usage: ' + ctx.prefix + 'find download');
      const hits = ctx.plugins
        .filter(
          (x) =>
            x.pattern &&
            (!x.owner || ctx.isOwner) &&
            [x.pattern, ...(x.aliases || []), x.desc || '', x.category || ''].join(' ').toLowerCase().includes(q)
        )
        .slice(0, 12);
      if (!hits.length) return ctx.reply('Nothing matches "' + q + '"');
      const lines = hits.map((x) => ctx.prefix + x.pattern + (x.desc ? ' — ' + x.desc : ''));
      await ctx.reply('*Find: ' + q + '*\n\n' + lines.join('\n') + '\n\n_' + ctx.prefix + 'menu_');
    },
  },
];
