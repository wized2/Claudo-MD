const native = require('../lib/native');
const ui = require('../lib/ui');
const store = require('../lib/jsonStore');
const { resolveTarget } = require('../lib/target');
const { guard } = require('../lib/groupTools');

const WARN_LIMIT = 3;
const loadWarns = () => store.readJson('warns.json', {});
const saveWarns = (w) => store.writeJson('warns.json', w);

function userAction(name, action, desc, verb) {
  return {
    name, pattern: name, category: 'group', group: true, desc, usage: name + ' <number|reply|mention>',
    async handler(ctx) {
      const g = await guard(ctx); if (!g) return;
      const t = await resolveTarget(ctx);
      if (!t.jid) return ctx.reply(ui.note(t.error || 'reply to, mention, or give a number'));
      try {
        await ctx.sock.groupParticipantsUpdate(ctx.jid, [t.jid], action);
        await ctx.reply(ui.card(verb, [ui.row('user', '+' + t.number)], { foot: false }));
      } catch (e) { await ctx.reply(ui.note('failed: ' + (e.message || e))); }
    },
  };
}

module.exports = [
  userAction('kick', 'remove', 'Remove a member', 'Removed'),
  userAction('add', 'add', 'Add a member by number', 'Added'),
  userAction('promote', 'promote', 'Make admin', 'Promoted'),
  userAction('demote', 'demote', 'Remove admin', 'Demoted'),
  {
    name: 'tagall', pattern: 'tagall', aliases: ['everyone'], category: 'group', group: true, desc: 'Mention every member',
    async handler(ctx) {
      const g = await guard(ctx, { needBot: false }); if (!g) return;
      const ids = g.meta.participants.map((x) => x.id);
      const note = ctx.args.join(' ');
      const lines = ids.map((id) => ui.item('@' + id.split('@')[0]));
      await ctx.reply({ text: ui.card('Attention', [note ? ui.bold(note) : '', ...lines].filter(Boolean), { foot: false }), mentions: ids });
    },
  },
  {
    name: 'hidetag', pattern: 'hidetag', aliases: ['h'], category: 'group', group: true, desc: 'Silent mention of everyone',
    async handler(ctx) {
      const g = await guard(ctx, { needBot: false }); if (!g) return;
      await ctx.sock.sendMessage(ctx.jid, { text: ctx.args.join(' ') || ' ', mentions: g.meta.participants.map((x) => x.id) });
    },
  },
  {
    name: 'mute', pattern: 'mute', category: 'group', group: true, desc: 'Only admins can send',
    async handler(ctx) { const g = await guard(ctx); if (!g) return; await ctx.sock.groupSettingUpdate(ctx.jid, 'announcement'); await ctx.reply(ui.row('chat', 'admins only')); },
  },
  {
    name: 'unmute', pattern: 'unmute', category: 'group', group: true, desc: 'Everyone can send',
    async handler(ctx) { const g = await guard(ctx); if (!g) return; await ctx.sock.groupSettingUpdate(ctx.jid, 'not_announcement'); await ctx.reply(ui.row('chat', 'open')); },
  },
  {
    name: 'link', pattern: 'link', aliases: ['invite'], category: 'group', group: true, desc: 'Group invite link',
    async handler(ctx) {
      const g = await guard(ctx); if (!g) return;
      const code = await ctx.sock.groupInviteCode(ctx.jid);
      const url = 'https://chat.whatsapp.com/' + code;
      await native.buttons(ctx, { title: g.meta.subject, body: ui.card('Invite link', [url], { foot: false }), footer: ctx.config.botName, buttons: [{ text: 'Open', url }, { text: 'Copy', copy: url }, { id: ctx.prefix + 'revoke', text: 'Revoke' }] });
    },
  },
  {
    name: 'revoke', pattern: 'revoke', category: 'group', group: true, desc: 'Reset invite link',
    async handler(ctx) { const g = await guard(ctx); if (!g) return; await ctx.sock.groupRevokeInvite(ctx.jid); await ctx.reply(ui.note('invite link reset')); },
  },
  {
    name: 'ginfo', pattern: 'ginfo', aliases: ['groupinfo'], category: 'group', group: true, desc: 'Group details',
    async handler(ctx) {
      const meta = await ctx.sock.groupMetadata(ctx.jid);
      const admins = meta.participants.filter((x) => x.admin).length;
      await ctx.reply(ui.card('Group', [ui.row('name', meta.subject), ui.row('members', meta.participants.length), ui.row('admins', admins), ui.row('created', new Date(meta.creation * 1000).toDateString()), meta.desc ? ui.row('about', String(meta.desc).slice(0, 200)) : ''].filter(Boolean)));
    },
  },
  {
    name: 'del', pattern: 'del', aliases: ['delete'], category: 'group', group: true, desc: 'Delete a replied message',
    async handler(ctx) {
      const g = await guard(ctx); if (!g) return;
      const ci = require('../lib/target').ctxInfo(ctx.m);
      if (!ci.stanzaId) return ctx.reply(ui.note('reply to the message to delete'));
      await ctx.sock.sendMessage(ctx.jid, { delete: { remoteJid: ctx.jid, fromMe: false, id: ci.stanzaId, participant: ci.participant } });
    },
  },
  {
    name: 'warn', pattern: 'warn', category: 'group', group: true, desc: 'Warn a member (3 = removed)',
    async handler(ctx) {
      const g = await guard(ctx); if (!g) return;
      const t = await resolveTarget(ctx);
      if (!t.jid) return ctx.reply(ui.note('reply to or mention a member'));
      const w = loadWarns(); const key = ctx.jid + '|' + t.number;
      w[key] = (w[key] || 0) + 1; saveWarns(w);
      const n = w[key];
      await ctx.reply({ text: ui.card('Warning', [ui.row('user', '@' + t.number), ui.row('count', n + ' / ' + WARN_LIMIT), ui.meter(n / WARN_LIMIT)], { foot: false }), mentions: [t.jid] });
      if (n >= WARN_LIMIT) {
        try { await ctx.sock.groupParticipantsUpdate(ctx.jid, [t.jid], 'remove'); delete w[key]; saveWarns(w); } catch (_) {}
      }
    },
  },
  {
    name: 'warns', pattern: 'warns', category: 'group', group: true, desc: 'Show or reset warnings (warns reset)',
    async handler(ctx) {
      const g = await guard(ctx, { needBot: false }); if (!g) return;
      const reset = (ctx.args[0] || '').toLowerCase() === 'reset';
      if (reset) ctx.args.shift();
      const t = await resolveTarget(ctx);
      if (!t.jid) return ctx.reply(ui.note('reply to or mention a member'));
      const w = loadWarns(); const key = ctx.jid + '|' + t.number;
      if (reset) { delete w[key]; saveWarns(w); return ctx.reply(ui.row('warnings', 'cleared')); }
      await ctx.reply(ui.card('Warnings', [ui.row('user', '+' + t.number), ui.row('count', (w[key] || 0) + ' / ' + WARN_LIMIT)], { foot: false }));
    },
  },
];
