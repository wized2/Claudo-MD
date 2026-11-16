const ui = require('../lib/ui');
const fx = require('../lib/textfx');
const remind = require('../lib/remind');
const native = require('../lib/native');

const body = (ctx) => ctx.args.join(' ').trim() || ((ctx.m && ctx.m.message && ((ctx.m.message.extendedTextMessage || {}).contextInfo || {}).quotedMessage) || {}).conversation || '';
const use = (ctx, t, ex) => ctx.reply(ui.card(t, [ui.cmd(ctx.prefix, ex)], { foot: false }));
const left = (ms) => { const s = Math.round(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24); return d ? d + 'd ' + (h % 24) + 'h' : h ? h + 'h ' + (m % 60) + 'm' : m ? m + 'm ' + (s % 60) + 's' : s + 's'; };

module.exports = [
  {
    name: 'fancy', pattern: 'fancy', aliases: ['font', 'style'], category: 'tools', desc: 'Stylish text in 7 fonts', usage: 'fancy <text>',
    async handler(ctx) { const t = body(ctx).slice(0, 200); if (!t) return use(ctx, 'Fancy text', 'fancy Claudo'); await ctx.reply(Object.keys(fx.STYLES).map((s) => fx.fancy(t, s)).join('\n')); },
  },
  {
    name: 'reverse', pattern: 'reverse', aliases: ['rev'], category: 'tools', desc: 'Reverse text', usage: 'reverse <text>',
    async handler(ctx) { const t = body(ctx); if (!t) return use(ctx, 'Reverse', 'reverse hello'); await ctx.reply(fx.reverse(t)); },
  },
  {
    name: 'base64', pattern: 'base64', aliases: ['b64'], category: 'tools', desc: 'Base64 encode or decode', usage: 'base64 enc|dec <text>',
    async handler(ctx) {
      const [mode, ...rest] = ctx.args; const t = rest.join(' ');
      if (!/^(enc|encode|dec|decode)$/i.test(mode || '') || !t) return use(ctx, 'Base64', 'base64 enc hello');
      try { await ctx.reply(/^enc/i.test(mode) ? Buffer.from(t, 'utf8').toString('base64') : Buffer.from(t, 'base64').toString('utf8')); } catch (e) { await ctx.reply(ui.small('invalid input')); }
    },
  },
  {
    name: 'morse', pattern: 'morse', category: 'tools', desc: 'Text to Morse and back', usage: 'morse <text|morse>',
    async handler(ctx) { const t = body(ctx); if (!t) return use(ctx, 'Morse', 'morse sos'); await ctx.reply(fx.isMorse(t) ? fx.fromMorse(t) : fx.toMorse(t)); },
  },
  {
    name: 'binary', pattern: 'binary', aliases: ['bin'], category: 'tools', desc: 'Text to binary and back', usage: 'binary <text|bits>',
    async handler(ctx) { const t = body(ctx).slice(0, 300); if (!t) return use(ctx, 'Binary', 'binary hi'); await ctx.reply(/^[01\s]+$/.test(t) && /\s|^.{8}$/.test(t) ? fx.fromBinary(t) : fx.toBinary(t)); },
  },
  {
    name: 'hash', pattern: 'hash', aliases: ['sha', 'md5'], category: 'tools', desc: 'MD5, SHA1 or SHA256 of text', usage: 'hash [md5|sha1|sha256] <text>',
    async handler(ctx) {
      let a = [...ctx.args]; let alg = 'sha256';
      if (/^(md5|sha1|sha256)$/i.test(a[0] || '')) alg = a.shift().toLowerCase();
      const t = a.join(' '); if (!t) return use(ctx, 'Hash', 'hash md5 hello');
      await ctx.reply(ui.card(alg.toUpperCase(), [fx.hash(alg, t)], { foot: false }));
    },
  },
  {
    name: 'ssweb', pattern: 'ssweb', aliases: ['screenshot', 'ss'], category: 'tools', desc: 'Screenshot of a website', usage: 'ssweb <url>',
    async handler(ctx) {
      let u = (ctx.args[0] || '').trim(); if (!u) return use(ctx, 'Screenshot', 'ssweb example.com');
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      try { const x = new URL(u); if (!/\./.test(x.hostname)) throw 0; } catch (e) { return ctx.reply(ui.small('that does not look like a link')); }
      try { await ctx.reply({ image: { url: 'https://image.thum.io/get/width/1280/crop/800/noanimate/' + u }, caption: ui.card('Screenshot', [ui.small(u.slice(0, 120))], { foot: false }) }); }
      catch (e) { await ctx.reply(ui.small('could not capture that page')); }
    },
  },
  {
    name: 'remind', pattern: 'remind', aliases: ['reminder', 'rem'], category: 'tools', desc: 'Remind me later: 10m, 2h, 1d', usage: 'remind <time> <message> | remind list | remind cancel <id>',
    async handler(ctx) {
      const sub = (ctx.args[0] || '').toLowerCase();
      if (sub === 'list') {
        const l = remind.forChat(ctx.jid);
        return ctx.reply(ui.card('Reminders', l.length ? l.map((r) => ui.item(r.id + '  ' + left(r.at - Date.now()) + '  ' + (r.text || ''))) : [ui.small('none')], { foot: false }));
      }
      if (sub === 'cancel') return ctx.reply(ui.row('cancelled', remind.cancel(ctx.jid, ctx.args[1] || '') ? 'yes' : 'not found'));
      let i = 0; const parts = [];
      while (i < ctx.args.length && /^\d+(\.\d+)?(d|h|m|s)$/i.test(ctx.args[i])) parts.push(ctx.args[i++]);
      const ms = remind.parseDelay(parts.join(' '));
      if (!ms) return use(ctx, 'Remind me', 'remind 10m drink water');
      try {
        const r = remind.add(ctx.sock, { jid: ctx.jid, who: ctx.sender, text: ctx.args.slice(i).join(' '), ms });
        await native.buttons(ctx, { title: 'Reminder set', body: ui.card('Reminder set', [ui.row('in', left(ms)), r.text ? ui.row('note', r.text) : '', ui.row('id', r.id)].filter(Boolean), { foot: false }), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'remind list', text: 'My reminders' }, { id: ctx.prefix + 'remind cancel ' + r.id, text: 'Cancel' }] });
      } catch (e) { await ctx.reply(ui.small(e.message)); }
    },
  },
];
