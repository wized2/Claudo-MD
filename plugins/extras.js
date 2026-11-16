const ui = require('../lib/ui');
const { guard } = require('../lib/groupTools');
const img = require('../lib/imgtools');

const body = (ctx) => ctx.args.join(' ').trim();

module.exports = [
  {
    name: 'ttp', pattern: 'ttp', aliases: ['textsticker', 'attp'], category: 'tools', desc: 'Turn text into a sticker', usage: 'ttp <text>',
    async handler(ctx) {
      const t = body(ctx) || ((((ctx.m && ctx.m.message && ctx.m.message.extendedTextMessage) || {}).contextInfo || {}).quotedMessage || {}).conversation || '';
      if (!t) return ctx.reply(ui.card('Text sticker', [ui.cmd(ctx.prefix, 'ttp Hello world')], { foot: false }));
      try { await ctx.reply({ sticker: await img.textSticker(t) }); } catch (e) { await ctx.reply(ui.note('could not make the sticker')); }
    },
  },
  {
    name: 'tagadmins', pattern: 'tagadmins', aliases: ['admins'], category: 'group', group: true, desc: 'Mention all group admins',
    async handler(ctx) {
      const meta = await ctx.sock.groupMetadata(ctx.jid);
      const ids = meta.participants.filter((x) => x.admin).map((x) => x.id);
      await ctx.reply({ text: ui.card('Admins', [body(ctx) ? ui.bold(body(ctx)) : '', ...ids.map((id) => ui.item('@' + id.split('@')[0]))].filter(Boolean), { foot: false }), mentions: ids });
    },
  },
  {
    name: 'setname', pattern: 'setname', aliases: ['gname'], category: 'group', group: true, desc: 'Change the group name', usage: 'setname <new name>',
    async handler(ctx) {
      const g = await guard(ctx); if (!g) return;
      const n = body(ctx).slice(0, 100); if (!n) return ctx.reply(ui.card('Group name', [ui.cmd(ctx.prefix, 'setname New name')], { foot: false }));
      try { await ctx.sock.groupUpdateSubject(ctx.jid, n); await ctx.reply(ui.row('name', n)); } catch (e) { await ctx.reply(ui.note('failed: ' + (e.message || e))); }
    },
  },
  {
    name: 'setdesc', pattern: 'setdesc', aliases: ['gdesc'], category: 'group', group: true, desc: 'Change the group description', usage: 'setdesc <text>',
    async handler(ctx) {
      const g = await guard(ctx); if (!g) return;
      const n = body(ctx).slice(0, 2000); if (!n) return ctx.reply(ui.card('Description', [ui.cmd(ctx.prefix, 'setdesc Rules: be kind')], { foot: false }));
      try { await ctx.sock.groupUpdateDescription(ctx.jid, n); await ctx.reply(ui.row('description', 'updated')); } catch (e) { await ctx.reply(ui.note('failed: ' + (e.message || e))); }
    },
  },
  {
    name: 'lock', pattern: 'lock', category: 'group', group: true, desc: 'Only admins can edit group info',
    async handler(ctx) { const g = await guard(ctx); if (!g) return; await ctx.sock.groupSettingUpdate(ctx.jid, 'locked'); await ctx.reply(ui.row('group info', 'admins only')); },
  },
  {
    name: 'unlock', pattern: 'unlock', category: 'group', group: true, desc: 'Everyone can edit group info',
    async handler(ctx) { const g = await guard(ctx); if (!g) return; await ctx.sock.groupSettingUpdate(ctx.jid, 'unlocked'); await ctx.reply(ui.row('group info', 'everyone')); },
  },
  {
    name: 'poll', pattern: 'poll', aliases: ['vote'], category: 'tools', desc: 'Create a poll: question | option | option', usage: 'poll <question> | <a> | <b> [| c...]',
    async handler(ctx) {
      const parts = body(ctx).split('|').map((s) => s.trim()).filter(Boolean);
      if (parts.length < 3 || parts.length > 13) return ctx.reply(ui.card('Poll', [ui.cmd(ctx.prefix, 'poll Lunch? | Pizza | Biryani | Burger'), ui.small('2 to 12 options')], { foot: false }));
      const [name, ...values] = parts;
      await ctx.sock.sendMessage(ctx.jid, { poll: { name: name.slice(0, 200), values: [...new Set(values.map((v) => v.slice(0, 100)))], selectableCount: 1 } });
    },
  },
  {
    name: 'owner', pattern: 'owner', aliases: ['creator', 'dev'], category: 'main', desc: 'Send the owner contact', direct: true,
    async handler(ctx) {
      const n = String(ctx.config.ownerNumber || '').replace(/\D/g, '');
      if (!n) return ctx.reply(ui.note('owner number is not set'));
      const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:' + ctx.config.botName + ' owner\nTEL;type=CELL;type=VOICE;waid=' + n + ':+' + n + '\nEND:VCARD';
      await ctx.sock.sendMessage(ctx.jid, { contacts: { displayName: ctx.config.botName + ' owner', contacts: [{ vcard }] } });
    },
  },
];
