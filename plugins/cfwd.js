const f = require('../lib/forward');
const detect = require('../lib/detect');
const native = require('../lib/native');
const ui = require('../lib/ui');
const engine = require('../lib/cfwdEngine');

async function toChannel(sock, token) {
  if (f.isChannelJid(token)) return { jid: f.normalizeChannelJid(token), name: '' };
  const r = await f.resolveChannelFromLink(sock, token);
  return { jid: r.jid, name: r.name || '' };
}

const short = (j) => String(j).replace(/@.*/, '').slice(0, 12);

const HELP = (p) => [
  ui.section('Rules'),
  ui.cmd(p, 'cfwd add <link|jid> <target|here> [ocfwd]'),
  ui.cmd(p, 'cfwd list'),
  ui.cmd(p, 'cfwd remove <n>'),
  ui.cmd(p, 'cfwd mode <n> ocfwd|normal', 'native channel tag or edited copy'),
  ui.cmd(p, 'cfwd footer <n> <text|off>'),
  ui.cmd(p, 'cfwd strip <n> <phrase>', 'drop lines containing it'),
  ui.section('Detection'),
  ui.cmd(p, 'cfwd links on|off', 'strip WhatsApp links, skip link-only posts'),
  ui.cmd(p, 'cfwd promo on|off', 'skip invite/promo posts'),
  ui.cmd(p, 'cfwd test <text>', 'see how a post would be judged'),
  ui.cmd(p, 'cfwd resolve <link>'),
];

module.exports = {
  name: 'cfwd', pattern: 'cfwd', aliases: ['ocfwd', 'forward'], category: 'forward', owner: true, desc: 'Channel forwarding hub', usage: 'cfwd help',
  async handler(ctx) {
    const { args, reply, sock, prefix: p } = ctx;
    const sub = (args[0] || '').toLowerCase();
    const rules = f.loadRules();
    const pick = (x) => rules[parseInt(x, 10) - 1];

    if (ctx.cmd === 'ocfwd' && sub === 'add') args.push('ocfwd');

    if (!sub) {
      return native.buttons(ctx, {
        title: 'Forwarding', body: ui.card('Forwarding', [ui.row('rules', rules.length), ui.row('queue', engine.status().pending), '', ui.small('Relay channel posts into groups or other channels.')], { foot: false }),
        footer: ctx.config.botName,
        buttons: [{ id: p + 'cfwd list', text: 'Rules' }, { id: p + 'status', text: 'Status' }, { id: p + 'cfwd help', text: 'Help' }],
      });
    }
    if (sub === 'help') return reply(ui.card('Forwarding help', HELP(p)));

    if (sub === 'list') {
      if (!rules.length) return reply(ui.card('Rules', [ui.small('none yet'), ui.cmd(p, 'cfwd add <link> here')]));
      const lines = rules.map((r, i) => `${ui.bold(String(i + 1))}  ${r.channelName || short(r.from)} ▸ ${short(r.to)}\n    ${ui.small((r.mode === 'ocfwd' ? 'native tag' : 'edited copy') + (r.enabled === false ? ' · off' : '') + (r.footer ? ' · footer' : ''))}`);
      return reply(ui.card('Rules', lines));
    }

    if (sub === 'resolve') {
      try {
        const c = await toChannel(sock, args[1] || '');
        return reply(ui.card('Channel', [ui.row('name', c.name || '-'), ui.row('jid', c.jid)]));
      } catch (e) { return reply(ui.small(e.message)); }
    }

    if (sub === 'add') {
      if (args.length < 3) return reply(ui.small(p + 'cfwd add <channel link|jid> <target jid|here> [ocfwd]'));
      let c;
      try { c = await toChannel(sock, args[1]); } catch (e) { return reply(ui.small(e.message)); }
      const to = args[2].toLowerCase() === 'here' ? ctx.jid : args[2];
      const mode = args.slice(3).some((x) => x.toLowerCase() === 'ocfwd') ? 'ocfwd' : 'normal';
      const idx = rules.findIndex((r) => r.from === c.jid && r.to === to);
      const rule = { from: c.jid, to, mode, nativeForward: mode === 'ocfwd', includeMedia: true, enabled: true, channelName: c.name };
      if (idx >= 0) rules[idx] = { ...rules[idx], ...rule }; else rules.push(rule);
      f.saveRules(rules);
      return reply(ui.card('Rule saved', [ui.row('from', c.name || short(c.jid)), ui.row('to', short(to)), ui.row('mode', mode)]));
    }

    const r = pick(args[1]);
    if (['remove', 'mode', 'footer', 'strip', 'on', 'off'].includes(sub)) {
      if (!r) return reply(ui.small('rule number? see ' + p + 'cfwd list'));
      const i = rules.indexOf(r);
      if (sub === 'remove') rules.splice(i, 1);
      else if (sub === 'mode') { const m = (args[2] || '').toLowerCase(); if (!['ocfwd', 'normal'].includes(m)) return reply(ui.small('ocfwd or normal')); r.mode = m; r.nativeForward = m === 'ocfwd'; }
      else if (sub === 'footer') { const t = args.slice(2).join(' '); if (!t || t === 'off') delete r.footer; else r.footer = t; }
      else if (sub === 'strip') { const t = args.slice(2).join(' '); if (!t) return reply(ui.small('phrase?')); r.stripPhrases = [...(r.stripPhrases || []), t]; }
      else r.enabled = sub === 'on';
      f.saveRules(rules);
      return reply(ui.card('Updated', [ui.row('rule', args[1]), ui.row('action', sub)]));
    }

    if (sub === 'links' || sub === 'promo') {
      const on = (args[1] || '').toLowerCase();
      if (on !== 'on' && on !== 'off') return reply(ui.small(p + 'cfwd ' + sub + ' on|off'));
      f.saveSettings(sub === 'links' ? { stripLinks: on === 'on' } : { stripPromo: on === 'on' });
      return reply(ui.row(sub, on));
    }

    if (sub === 'test') {
      const t = args.slice(1).join(' ');
      if (!t) return reply(ui.small(p + 'cfwd test <text>'));
      const d = detect.analyze(t);
      return reply(ui.card('Detection', [ui.row('verdict', d.spam ? 'skip as promo' : 'forward'), ui.row('score', d.score + ' / 6'), ui.row('links', d.links), ...d.reasons.map(ui.item)]));
    }
    return reply(ui.small('unknown. ' + p + 'cfwd help'));
  },
};
