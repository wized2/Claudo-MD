const native = require('../lib/native');
const ui = require('../lib/ui');
const web = require('../lib/web');
const { ctxInfo } = require('../lib/target');

const use = (ctx, t, ex) => ctx.reply(ui.card(t, [ui.cmd(ctx.prefix, ex)], { foot: false }));
const fail = (ctx, e) => ctx.reply(ui.small(String((e && e.message) || e)));
const n1 = (x) => Math.round(x * 10) / 10;

function quotedText(m) {
  const q = ctxInfo(m).quotedMessage || {};
  return q.conversation || (q.extendedTextMessage && q.extendedTextMessage.text) || (q.imageMessage && q.imageMessage.caption) || '';
}

const LANGS = { en: 'English', ur: 'Urdu', hi: 'Hindi', ar: 'Arabic', fa: 'Persian', fr: 'French', de: 'German', es: 'Spanish', tr: 'Turkish', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', pt: 'Portuguese', it: 'Italian', id: 'Indonesian', bn: 'Bengali', pa: 'Punjabi' };

module.exports = [
  {
    name: 'weather', pattern: 'weather', aliases: ['w', 'forecast'], category: 'info', desc: 'Weather and 3 day forecast', usage: 'weather <city>',
    async handler(ctx) {
      const q = ctx.args.join(' ').trim(); if (!q) return use(ctx, 'Weather', 'weather Lahore');
      let r; try { r = await web.weather(q); } catch (e) { return fail(ctx, e); }
      const lines = [ui.bold(r.place), '', ui.row('now', r.now.text), ui.row('temp', n1(r.now.temp) + ' C  (feels ' + n1(r.now.feels) + ')'), ui.row('humidity', r.now.humidity + '%'), ui.row('wind', n1(r.now.wind) + ' km/h'), ui.section('Next days'), ...r.days.slice(1).map((d) => ui.item(d.date.slice(5) + '   ' + n1(d.min) + ' to ' + n1(d.max) + ' C   ' + ui.small(d.text)))];
      await ctx.reply(ui.card('Weather', lines, { foot: false }));
    },
  },
  {
    name: 'tr', pattern: 'tr', aliases: ['translate'], category: 'info', desc: 'Translate text (reply or type)', usage: 'tr <lang> <text>  e.g. tr ur good morning',
    async handler(ctx) {
      const p = ctx.prefix; let a = ctx.args.slice(); let to = 'en';
      if (a[0] && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(a[0]) && (LANGS[a[0]] || a.length > 1 || quotedText(ctx.m))) { to = a.shift(); }
      const text = a.join(' ').trim() || quotedText(ctx.m);
      if (!text) {
        const rows = Object.entries(LANGS).slice(0, 10).map(([k, v]) => ({ id: p + 'tr ' + k, title: v, description: p + 'tr ' + k + ' <text>' }));
        return native.list(ctx, { title: 'Translate', body: ui.card('Translate', [ui.cmd(p, 'tr ur good morning'), ui.small('or reply to a message with ' + p + 'tr ur')], { foot: false }), footer: ctx.config.botName, button: 'Languages', sections: [{ title: 'Languages', rows }] });
      }
      try { const r = await web.translate(text, to); await ctx.reply(ui.card('Translate', [ui.row(r.from + ' to ' + to, ''), '', r.text], { foot: false })); } catch (e) { fail(ctx, e); }
    },
  },
  {
    name: 'wiki', pattern: 'wiki', aliases: ['wikipedia'], category: 'info', desc: 'Wikipedia summary', usage: 'wiki <topic>',
    async handler(ctx) {
      const q = ctx.args.join(' ').trim(); if (!q) return use(ctx, 'Wikipedia', 'wiki Allama Iqbal');
      let r; try { r = await web.wiki(q); } catch (e) { return fail(ctx, e); }
      const body = ui.card(r.title, [r.extract.slice(0, 900)], { foot: false });
      if (r.image) await ctx.reply({ image: { url: r.image }, caption: body }).catch(() => ctx.reply(body)); else await ctx.reply(body);
      if (r.url) await native.buttons(ctx, { title: r.title, body: ui.small('Read the full article'), footer: ctx.config.botName, buttons: [{ text: 'Open article', url: r.url }] });
    },
  },
  {
    name: 'define', pattern: 'define', aliases: ['dict', 'meaning'], category: 'info', desc: 'Dictionary definition', usage: 'define <word>',
    async handler(ctx) {
      const q = ctx.args[0]; if (!q) return use(ctx, 'Dictionary', 'define serendipity');
      let r; try { r = await web.define(q); } catch (e) { return fail(ctx, e); }
      const lines = [ui.bold(r.word) + (r.phonetic ? '  ' + ui.small(r.phonetic) : ''), '', ...r.meanings.flatMap((m) => [ui.row(m.pos, m.def || ''), m.ex ? '    ' + ui.small('"' + m.ex + '"') : ''].filter(Boolean))];
      await ctx.reply(ui.card('Dictionary', lines, { foot: false }));
    },
  },
  {
    name: 'cur', pattern: 'cur', aliases: ['convert', 'currency'], category: 'info', desc: 'Currency converter', usage: 'cur 100 usd pkr',
    async handler(ctx) {
      const [amt, from, to] = ctx.args; const a = parseFloat(amt);
      if (!(a > 0) || !from || !to) return use(ctx, 'Currency', 'cur 100 usd pkr');
      try { const r = await web.convert(a, from, to); await ctx.reply(ui.card('Currency', [ui.bold(a + ' ' + r.from + ' = ' + (Math.round(r.value * 100) / 100).toLocaleString('en-US') + ' ' + r.to), ui.row('rate', '1 ' + r.from + ' = ' + r.rate + ' ' + r.to)], { foot: false })); } catch (e) { fail(ctx, e); }
    },
  },
];
