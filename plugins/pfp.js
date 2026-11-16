const ui = require('../lib/ui');
const { resolveTarget } = require('../lib/target');

module.exports = [
  {
    name: 'pfp', pattern: 'pfp', aliases: ['dp', 'profilepic'], category: 'tools', desc: 'Profile picture by number, mention or reply',
    usage: 'pfp <number>',
    async handler(ctx) {
      const p = ctx.prefix;
      const t = await resolveTarget(ctx, { allowSelfDm: true });
      if (t.error) return ctx.reply(ui.note(t.error));
      if (!t.jid) return ctx.reply(ui.card('Profile picture', [ui.cmd(p, 'pfp 923001234567'), ui.small('or reply to / mention someone')]));
      let url = null;
      try { url = await ctx.sock.profilePictureUrl(t.jid, 'image'); } catch (_) {}
      if (!url) return ctx.reply(ui.note('no picture (not set, or hidden by privacy)'));
      await ctx.reply({ image: { url }, caption: ui.card('Profile picture', [ui.row('number', '+' + t.number)], { foot: false }) });
    },
  },
];
