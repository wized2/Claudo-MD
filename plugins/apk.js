const native = require('../lib/native');
const ui = require('../lib/ui');
const apk = require('../lib/apk');

const usage = (ctx) => ctx.reply(ui.card('APK download', [ui.cmd(ctx.prefix, 'apk whatsapp'), ui.small('Search Aptoide, then tap an app to get the file')], { foot: false }));

module.exports = [
  {
    name: 'apk', pattern: 'apk', aliases: ['app', 'aptoide'], category: 'download', desc: 'Search and download Android apps (Aptoide)', usage: 'apk <app name>',
    async handler(ctx) {
      const p = ctx.prefix; const q = ctx.args.join(' ').trim();
      if (!q) return usage(ctx);
      let res;
      try { res = await apk.search(q, 8); } catch (e) { return ctx.reply(ui.note('search failed: ' + (e.message || e))); }
      if (!res.length) return ctx.reply(ui.note('no app found for "' + q + '"'));
      const lines = res.map((a) => ui.item(ui.bold(a.name) + '  ' + ui.small('v' + a.version + '  ' + apk.mb(a.size) + '  ' + apk.short(a.downloads) + ' downloads')));
      const rows = res.map((a) => ({ id: p + 'apkget ' + a.pkg, title: a.name.slice(0, 24), description: ('v' + a.version + ' · ' + apk.mb(a.size) + ' · ' + a.pkg).slice(0, 72) }));
      await native.list(ctx, { title: 'Apps', body: ui.card('Aptoide results', [ui.small('for "' + q + '"'), '', ...lines], { foot: false }), footer: ctx.config.botName, button: 'Pick an app', sections: [{ title: 'Results', rows }] });
    },
  },
  {
    name: 'apkget', pattern: 'apkget', category: 'download', desc: 'Send the APK for a package id', usage: 'apkget <package>',
    async handler(ctx) {
      const pkg = (ctx.args[0] || '').trim();
      if (!/^[A-Za-z0-9_.]{3,150}$/.test(pkg)) return usage(ctx);
      let a;
      try { a = await apk.byPackage(pkg); } catch (e) { return ctx.reply(ui.note('lookup failed: ' + (e.message || e))); }
      if (!a) return ctx.reply(ui.note('package not found'));
      const lines = [ui.bold(a.name), ui.row('version', a.version), ui.row('size', apk.mb(a.size)), a.dev ? ui.row('developer', a.dev) : '', ui.row('downloads', apk.short(a.downloads)), ui.row('scan', a.trusted ? 'trusted' : 'not verified'), ui.row('package', a.pkg)].filter(Boolean);
      if (a.obb) lines.push('', ui.small('This app uses extra OBB data and may not run from the APK alone.'));
      const card = ui.card('APK', lines, { foot: false });
      const tooBig = a.size > apk.MAX_MB() * 1048576;
      if (tooBig) {
        return native.buttons(ctx, { title: a.name, body: card + '\n' + ui.small('Over ' + apk.MAX_MB() + ' MB, so here is the direct link.'), footer: ctx.config.botName, buttons: [{ text: 'Download', url: a.url }] });
      }
      if (a.icon) await ctx.reply({ image: { url: a.icon }, caption: card }).catch(() => ctx.reply(card));
      else await ctx.reply(card);
      try {
        await ctx.reply({ document: { url: a.url }, mimetype: 'application/vnd.android.package-archive', fileName: (a.name.replace(/[^\w.\- ]+/g, '').trim() || a.pkg) + ' v' + a.version + '.apk' });
      } catch (e) {
        await native.buttons(ctx, { title: a.name, body: ui.small('Could not send the file here. Use the link.'), footer: ctx.config.botName, buttons: [{ text: 'Download', url: a.url }] });
      }
    },
  },
];
