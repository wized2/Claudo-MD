const native = require('../lib/native');
const ui = require('../lib/ui');
const dl = require('../lib/dl');

const usage = (ctx, t, ex) => ctx.reply(ui.card(t, [ui.cmd(ctx.prefix, ex)], { foot: false }));

async function sendFile(ctx, url, kind, title) {
  const r = await dl.fetchBuffer(url);
  if (r.tooBig) return native.buttons(ctx, { title, body: ui.card('Too large to send', [ui.small('Over 64 MB. Use the link instead.')], { foot: false }), footer: ctx.config.botName, buttons: [{ text: 'Download', url }] });
  if (kind === 'audio') return ctx.reply({ audio: r.buffer, mimetype: 'audio/mpeg', fileName: title + '.mp3' });
  return ctx.reply({ video: r.buffer, mimetype: 'video/mp4', caption: ui.bold(title) });
}

module.exports = [
  {
    name: 'yt', pattern: 'yt', aliases: ['youtube'], category: 'download', desc: 'YouTube: link or search, pick audio or video', usage: 'yt <link or search>',
    async handler(ctx) {
      const q = ctx.args.join(' ').trim(); const p = ctx.prefix;
      if (!q) return usage(ctx, 'YouTube', 'yt never gonna give you up');
      let i;
      try { i = await dl.ytInfo(q, 'audio'); } catch (e) { return ctx.reply(ui.small('not found: ' + (e.message || e))); }
      const lines = [ui.bold(i.title), ui.row('length', dl.mins(i.duration)), i.url ? ui.row('link', i.url) : ''].filter(Boolean);
      const body = ui.card('YouTube', lines, { foot: false });
      const link = i.url || q;
      if (i.thumbnail) await ctx.reply({ image: { url: i.thumbnail }, caption: body }).catch(() => {});
      await native.buttons(ctx, { title: 'Download', body: i.thumbnail ? ui.small(i.title) : body, footer: ctx.config.botName, buttons: [{ id: p + 'ytget audio ' + link, text: 'Audio' }, { id: p + 'ytget video ' + link, text: 'Video' }] });
    },
  },
  {
    name: 'ytget', pattern: 'ytget', category: 'download', desc: 'Send the audio or video of a YouTube link', usage: 'ytget audio|video <link>',
    async handler(ctx) {
      const kind = (ctx.args[0] || '').toLowerCase(); const q = ctx.args.slice(1).join(' ');
      if (!['audio', 'video'].includes(kind) || !q) return usage(ctx, 'YouTube', 'ytget audio <link>');
      let i;
      try { i = await dl.ytInfo(q, kind); } catch (e) { return ctx.reply(ui.small('could not fetch: ' + (e.message || e))); }
      await ctx.reply(ui.small('sending ' + kind + ', one moment'));
      try { await sendFile(ctx, i.download, kind, i.title); } catch (e) { await ctx.reply(ui.small('download failed: ' + (e.message || e))); }
    },
  },
  {
    name: 'song', pattern: 'song', aliases: ['music', 'mp3'], category: 'download', desc: 'Search and get a song as audio', usage: 'song <name>',
    async handler(ctx) {
      const q = ctx.args.join(' ').trim(); if (!q) return usage(ctx, 'Song', 'song kesariya');
      let i;
      try { i = await dl.ytInfo(q, 'audio'); } catch (e) { return ctx.reply(ui.small('not found: ' + (e.message || e))); }
      await ctx.reply(ui.card('Song', [ui.bold(i.title), ui.row('length', dl.mins(i.duration))], { foot: false }));
      try { await sendFile(ctx, i.download, 'audio', i.title); } catch (e) { await ctx.reply(ui.small('download failed: ' + (e.message || e))); }
    },
  },
  {
    name: 'video', pattern: 'video', aliases: ['ytv'], category: 'download', desc: 'Search and get a video', usage: 'video <name or link>',
    async handler(ctx) {
      const q = ctx.args.join(' ').trim(); if (!q) return usage(ctx, 'Video', 'video funny cats');
      let i;
      try { i = await dl.ytInfo(q, 'video'); } catch (e) { return ctx.reply(ui.small('not found: ' + (e.message || e))); }
      try { await sendFile(ctx, i.download, 'video', i.title); } catch (e) { await ctx.reply(ui.small('download failed: ' + (e.message || e))); }
    },
  },
  {
    name: 'tt', pattern: 'tt', aliases: ['tiktok'], category: 'download', desc: 'TikTok video without watermark', usage: 'tt <link>',
    async handler(ctx) {
      const u = ctx.args[0]; if (!u || !dl.isTikTok(u)) return usage(ctx, 'TikTok', 'tt https://vm.tiktok.com/...');
      let d;
      try { d = await dl.tiktok(u); } catch (e) { return ctx.reply(ui.small('could not fetch: ' + (e.message || e))); }
      const cap = ui.card('TikTok', [d.author ? ui.row('by', d.author) : '', d.title ? ui.small(d.title.slice(0, 200)) : ''].filter(Boolean), { foot: false });
      try {
        if (d.images.length) { for (const im of d.images.slice(0, 6)) await ctx.reply({ image: { url: im } }); return; }
        const r = await dl.fetchBuffer(d.video);
        if (r.tooBig) return native.buttons(ctx, { title: 'TikTok', body: cap, footer: ctx.config.botName, buttons: [{ text: 'Download', url: d.video }] });
        await ctx.reply({ video: r.buffer, mimetype: 'video/mp4', caption: cap });
      } catch (e) { await ctx.reply(ui.small('download failed: ' + (e.message || e))); }
    },
  },
];
