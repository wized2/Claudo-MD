const native = require('../lib/native');
const ui = require('../lib/ui');
const media = require('../lib/media');
const img = require('../lib/imgtools');

const need = (ctx, what) => ctx.reply(ui.card(what, [ui.small('reply to it, or send it with the command as caption')], { foot: false }));

module.exports = [
  {
    name: 'qr', pattern: 'qr', category: 'tools', desc: 'Make a QR code from text or a link', usage: 'qr <text>',
    async handler(ctx) {
      const t = ctx.args.join(' ').trim();
      if (!t) return ctx.reply(ui.card('QR', [ui.cmd(ctx.prefix, 'qr https://example.com')], { foot: false }));
      await ctx.reply({ image: await img.qrPng(t), caption: ui.card('QR code', [ui.small(t.slice(0, 120))], { foot: false }) });
    },
  },
  {
    name: 'short', pattern: 'short', aliases: ['shorten', 'tiny'], category: 'tools', desc: 'Shorten a link', usage: 'short <url>',
    async handler(ctx) {
      const u = ctx.args[0];
      if (!u) return ctx.reply(ui.card('Shorten', [ui.cmd(ctx.prefix, 'short https://example.com/long/link')], { foot: false }));
      try {
        const s = await img.shorten(u);
        await native.buttons(ctx, { title: 'Short link', body: ui.card('Short link', [s], { foot: false }), footer: ctx.config.botName, buttons: [{ text: 'Open', url: s }, { text: 'Copy', copy: s }] });
      } catch (e) { await ctx.reply(ui.small('could not shorten: ' + (e.message || e))); }
    },
  },
  {
    name: 'sticker', pattern: 'sticker', aliases: ['s', 'stick'], category: 'tools', desc: 'Image to sticker', usage: 'sticker (reply to an image)',
    async handler(ctx) {
      const f = media.findMedia(ctx.m);
      if (!f || f.kind !== 'image') return need(ctx, 'Sticker maker');
      try { await ctx.reply({ sticker: await img.toSticker(await media.download(ctx.sock, f)) }); }
      catch (e) { await ctx.reply(ui.small('could not make the sticker: ' + (e.message || e))); }
    },
  },
  {
    name: 'toimg', pattern: 'toimg', aliases: ['unsticker'], category: 'tools', desc: 'Sticker to image', usage: 'toimg (reply to a sticker)',
    async handler(ctx) {
      const f = media.findMedia(ctx.m);
      if (!f || f.kind !== 'sticker') return need(ctx, 'Sticker to image');
      try { await ctx.reply({ image: await img.stickerToPng(await media.download(ctx.sock, f)) }); }
      catch (e) { await ctx.reply(ui.small('could not convert: ' + (e.message || e))); }
    },
  },
  {
    name: 'vv', pattern: 'vv', aliases: ['viewonce'], category: 'owner', owner: true, desc: 'Reveal a view-once photo or video', usage: 'vv (reply to it)',
    async handler(ctx) {
      const f = media.findMedia(ctx.m);
      if (!f || !f.viewOnce || !['image', 'video', 'audio'].includes(f.kind)) return ctx.reply(ui.card('View once', [ui.small('reply to a view-once photo or video')], { foot: false }));
      try {
        const buf = await media.download(ctx.sock, f);
        const cap = (f.node && f.node.caption) || '';
        const body = f.kind === 'image' ? { image: buf, caption: cap } : f.kind === 'video' ? { video: buf, caption: cap } : { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: !!(f.node && f.node.ptt) };
        await ctx.reply(body);
      } catch (e) { await ctx.reply(ui.small('could not open it: ' + (e.message || e))); }
    },
  },
];
