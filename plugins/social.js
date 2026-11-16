const ui = require('../lib/ui');
const afk = require('../lib/afk');
const protect = require('../lib/protect');
const settings = require('../lib/settings');
const { guard } = require('../lib/groupTools');
const { digits } = require('../lib/owner');

const LANGS = { en: 1, ur: 1, ar: 1, hi: 1, fr: 1, es: 1, tr: 1, id: 1, bn: 1, fa: 1, ps: 0 };

module.exports = [
  {
    name: 'tts', pattern: 'tts', aliases: ['say', 'speak'], category: 'tools', desc: 'Text to speech (en, ur, ar, hi...)', usage: 'tts [lang] <text>', direct: true,
    async handler(ctx) {
      let a = [...ctx.args]; let lang = 'en';
      if (a[0] && LANGS[a[0].toLowerCase()]) lang = a.shift().toLowerCase();
      const text = a.join(' ').trim().slice(0, 200);
      if (!text) return ctx.reply(ui.card('Text to speech', [ui.cmd(ctx.prefix, 'tts hello there'), ui.cmd(ctx.prefix, 'tts ur السلام علیکم'), ui.small('languages: ' + Object.keys(LANGS).filter((k) => LANGS[k]).join(' ')), ui.small('max 200 characters')], { foot: false }));
      const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + lang + '&q=' + encodeURIComponent(text);
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 500) throw new Error('empty audio');
        await ctx.reply({ audio: buf, mimetype: 'audio/mpeg', fileName: 'tts.mp3' });
      } catch (e) { await ctx.reply(ui.small('tts failed: ' + (e.message || e))); }
    },
  },
  {
    name: 'afk', pattern: 'afk', category: 'main', desc: 'Set yourself away; I tell people who tag you', usage: 'afk [reason]', direct: true,
    async handler(ctx) {
      const e = afk.set(ctx.m, ctx.jid, ctx.args.join(' '));
      await ctx.reply(ui.card('AFK', [ui.row('status', 'away'), e.reason ? ui.row('reason', e.reason) : '', ui.small('send any message to come back')].filter(Boolean), { foot: false }));
    },
  },
  {
    name: 'antibad', pattern: 'antibad', aliases: ['antibadword', 'badwords'], category: 'group', group: true, desc: 'Delete listed words (admin)', usage: 'antibad off|warn|kick | add <word> | del <word> | list',
    async handler(ctx) {
      const g = await guard(ctx, { needBot: false });
      if (!g) return;
      const sub = (ctx.args[0] || '').toLowerCase(); const w = (ctx.args[1] || '').toLowerCase();
      const cfg = protect.getCfg(ctx.jid);
      if (['off', 'warn', 'kick'].includes(sub)) protect.setCfg(ctx.jid, { antibad: sub });
      else if (sub === 'add' && w) protect.setCfg(ctx.jid, { badwords: [...new Set([...cfg.badwords, w])].slice(0, 200) });
      else if ((sub === 'del' || sub === 'remove') && w) protect.setCfg(ctx.jid, { badwords: cfg.badwords.filter((x) => x !== w) });
      const c = protect.getCfg(ctx.jid);
      await ctx.reply(ui.card('Anti bad words', [ui.row('mode', c.antibad), ui.row('words', c.badwords.length), sub === 'list' ? c.badwords.join(', ') || ui.small('none yet') : ui.small('add words with ' + ctx.prefix + 'antibad add <word>')], { foot: false }));
    },
  },
  {
    name: 'ban', pattern: 'ban', category: 'owner', owner: true, desc: 'Block a number from using the bot', usage: 'ban <number|reply|mention>', direct: false,
    async handler(ctx) {
      const t = await require('../lib/target').resolveTarget(ctx, { allowSelfDm: false });
      if (!t || t.error || !t.number) return ctx.reply(ui.small((t && t.error) || 'give a number, mention or reply'));
      const d = digits(t.number); const list = new Set(settings.get('banned') || []); list.add(d); settings.set('banned', [...list]);
      await ctx.reply(ui.row('banned', d));
    },
  },
  {
    name: 'unban', pattern: 'unban', category: 'owner', owner: true, desc: 'Allow a banned number again', usage: 'unban <number|reply|mention>',
    async handler(ctx) {
      const t = await require('../lib/target').resolveTarget(ctx, { allowSelfDm: false });
      if (!t || t.error || !t.number) return ctx.reply(ui.small((t && t.error) || 'give a number, mention or reply'));
      const list = (settings.get('banned') || []).filter((x) => x !== digits(t.number));
      settings.set('banned', list);
      await ctx.reply(ui.row('banned now', list.length));
    },
  },
];
