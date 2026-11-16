const native = require('../lib/native');
const ui = require('../lib/ui');
const api = require('../lib/apis');

const fail = (ctx, e) => ctx.reply(ui.small('request failed: ' + (e.message || e)));
const nf = (ctx, what) => ctx.reply(ui.small(what + ' not found'));
const usage = (ctx, t, ex) => ctx.reply(ui.card(t, [ui.cmd(ctx.prefix, ex)], { foot: false }));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

module.exports = [
  {
    name: 'prayer', pattern: 'prayer', aliases: ['namaz', 'salah', 'azan'], category: 'info', desc: 'Prayer times for a city', usage: 'prayer [city[, country]]', direct: true,
    async handler(ctx) {
      const q = ctx.args.join(' ').trim() || 'Karachi';
      let r; try { r = await api.prayer(q); } catch (e) { return fail(ctx, e); }
      if (!r) return nf(ctx, 'city');
      const rows = Object.entries(r.times).map(([k, v]) => ui.row(k.toLowerCase(), v));
      await native.buttons(ctx, { title: 'Prayer times', body: ui.card(r.city + ', ' + r.country, [ui.small((r.date || '') + (r.hijri ? '  ·  ' + r.hijri + ' H' : '')), '', ...rows, '', ui.small('timezone ' + (r.tz || '') + ' · Karachi method')], { foot: false }), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'prayer ' + q, text: 'Refresh' }, { id: ctx.prefix + 'ayah random', text: 'Random ayah' }] });
    },
  },
  {
    name: 'ayah', pattern: 'ayah', aliases: ['quran', 'verse'], category: 'info', desc: 'Quran verse, e.g. 2:255 or random', usage: 'ayah <surah:ayah|random>', direct: true,
    async handler(ctx) {
      let ref = (ctx.args[0] || '').toLowerCase();
      if (!ref) return usage(ctx, 'Quran', 'ayah 2:255');
      if (ref === 'random') ref = String(1 + Math.floor(Math.random() * 6236));
      let r; try { r = await api.ayah(ref); } catch (e) { return fail(ctx, e); }
      if (!r) return nf(ctx, 'verse');
      await native.buttons(ctx, { title: 'Quran', body: ui.card(r.surah + ' ' + r.surahNo + ':' + r.n, [r.arabic, '', ui.small(r.english)], { foot: false }), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'ayah random', text: 'Another' }, { id: ctx.prefix + 'prayer', text: 'Prayer times' }] });
    },
  },
  {
    name: 'github', pattern: 'github', aliases: ['gh', 'repo'], category: 'info', desc: 'GitHub user or repo info', usage: 'github <user | owner/repo>', direct: true,
    async handler(ctx) {
      const q = ctx.args.join(' ').trim();
      if (!q) return usage(ctx, 'GitHub', 'github wized2/Claudo-MD');
      let r; try { r = await api.github(q); } catch (e) { return fail(ctx, e); }
      if (!r) return nf(ctx, 'user or repo');
      const lines = r.kind === 'repo'
        ? [ui.bold(r.name), r.desc ? ui.small(r.desc) : '', '', ui.row('stars', r.stars), ui.row('forks', r.forks), ui.row('issues', r.issues), r.lang ? ui.row('language', r.lang) : '', r.license ? ui.row('license', r.license) : '', ui.row('pushed', r.updated)]
        : [ui.bold(r.name + (r.full ? '  ' + r.full : '')), r.bio ? ui.small(r.bio) : '', '', ui.row('repos', r.repos), ui.row('followers', r.followers), ui.row('following', r.following), r.location ? ui.row('location', r.location) : '', ui.row('joined', r.since)];
      const card = ui.card('GitHub', lines.filter((x) => x !== ''), { foot: false });
      if (r.avatar) await ctx.reply({ image: { url: r.avatar }, caption: card }).catch(() => ctx.reply(card)); else await ctx.reply(card);
      await native.buttons(ctx, { title: 'GitHub', body: ui.small(r.url), footer: ctx.config.botName, buttons: [{ text: 'Open', url: r.url }] });
    },
  },
  {
    name: 'pokemon', pattern: 'pokemon', aliases: ['poke', 'pokedex'], category: 'info', desc: 'Pokedex entry by name or number', usage: 'pokemon <name|id>', direct: true,
    async handler(ctx) {
      const q = ctx.args[0] || (ctx.cmd === 'pokemon' && String(1 + Math.floor(Math.random() * 1000)));
      let r; try { r = await api.pokemon(q); } catch (e) { return fail(ctx, e); }
      if (!r) return nf(ctx, 'pokemon');
      const s = r.stats;
      const card = ui.card('#' + r.id + ' ' + cap(r.name), [ui.row('type', r.types.map(cap).join(', ')), ui.row('size', r.height + ' m  ·  ' + r.weight + ' kg'), ui.row('abilities', r.abilities.map(cap).join(', ')), '', ui.row('hp', s.hp), ui.row('attack', s.attack), ui.row('defense', s.defense), ui.row('speed', s.speed)], { foot: false });
      if (r.image) await ctx.reply({ image: { url: r.image }, caption: card }).catch(() => ctx.reply(card)); else await ctx.reply(card);
      await native.buttons(ctx, { title: 'Pokedex', body: ui.small('Catch another?'), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'pokemon ' + (Math.floor(Math.random() * 1000) + 1), text: 'Random' }, { id: ctx.prefix + 'pokemon ' + (r.id + 1), text: 'Next' }] });
    },
  },
  {
    name: 'crypto', pattern: 'crypto', aliases: ['coin', 'price'], category: 'info', desc: 'Crypto price (Binance spot)', usage: 'crypto <symbol>', direct: true,
    async handler(ctx) {
      const q = ctx.args[0] || 'btc';
      let r; try { r = await api.crypto(q); } catch (e) { return fail(ctx, e); }
      if (!r) return nf(ctx, 'symbol');
      const up = r.change >= 0;
      await native.buttons(ctx, { title: 'Crypto', body: ui.card(r.pair, [ui.row('price', '$' + api.num(r.price)), ui.row('24h', (up ? '+' : '') + r.change.toFixed(2) + '%'), ui.row('high', '$' + api.num(r.high)), ui.row('low', '$' + api.num(r.low)), ui.row('volume', '$' + Math.round(r.volume).toLocaleString('en-US'))], { foot: false }), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'crypto btc', text: 'BTC' }, { id: ctx.prefix + 'crypto eth', text: 'ETH' }, { id: ctx.prefix + 'crypto ' + q, text: 'Refresh' }] });
    },
  },
];
