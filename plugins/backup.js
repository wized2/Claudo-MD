const fs = require('fs');
const native = require('../lib/native');
const ui = require('../lib/ui');
const B = require('../lib/backup');
const store = require('../lib/jsonStore');
const settings = require('../lib/settings');
const media = require('../lib/media');

const sessionDir = () => require('path').resolve(require('../config').sessionDir);
const dirs = () => ({ dataDir: store.dataDir(), sessionDir: sessionDir() });
const ownerJid = (config) => String(config.ownerNumber || '').replace(/\D/g, '') + '@s.whatsapp.net';

module.exports = [
  {
    name: 'backup', pattern: 'backup', category: 'owner', owner: true, desc: 'Export all bot data as a file you can save', usage: 'backup [full]',
    async handler(ctx) {
      const full = (ctx.args[0] || '').toLowerCase() === 'full';
      const b = B.build({ ...dirs(), full });
      const s = B.summary(b);
      const to = ctx.group ? ownerJid(ctx.config) : ctx.jid;
      await ctx.sock.sendMessage(to, { document: Buffer.from(JSON.stringify(b)), mimetype: 'application/json', fileName: B.fileName(full), caption: ui.card('Backup', [ui.row('files', s.files), full ? ui.row('session', s.session + ' files') : ui.small('settings only, no login'), '', ui.small('Save this file somewhere safe. Reply to it with ' + ctx.prefix + 'restore' + (full ? ' full' : '') + '.'), full ? ui.small('This contains your WhatsApp login. Never share it.') : ''].filter((x) => x !== ''), { foot: false }) });
      if (ctx.group) await ctx.reply(ui.small('backup sent to your DM'));
      else if (!full) await native.buttons(ctx, { title: 'Backup', body: ui.small('Settings backup is above. Full includes the WhatsApp login so you can skip pairing.'), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'backup full', text: 'Full backup' }, { id: ctx.prefix + 'autobackup 24', text: 'Auto daily' }] });
    },
  },
  {
    name: 'restore', pattern: 'restore', category: 'owner', owner: true, desc: 'Restore from a backup file (reply to it)', usage: 'restore [full]',
    async handler(ctx) {
      const f = media.findMedia(ctx.m);
      if (!f || f.kind !== 'document') return ctx.reply(ui.card('Restore', [ui.small('reply to a backup file with ' + ctx.prefix + 'restore'), ui.small('add "full" to also restore the WhatsApp login')], { foot: false }));
      let obj;
      try { obj = B.validate(B.parse(await media.download(ctx.sock, f))); } catch (e) { return ctx.reply(ui.small('not a valid backup: ' + (e.message || e))); }
      const withSession = (ctx.args[0] || '').toLowerCase() === 'full';
      const r = B.restore(obj, { ...dirs(), withSession });
      const needs = r.session > 0;
      await ctx.reply(ui.card('Restored', [ui.row('files', r.data), withSession ? ui.row('session', r.session + ' files') : '', ui.row('made', obj.createdAt), '', ui.small('Restarting to apply. If the bot does not come back, start it again.')].filter((x) => x !== ''), { foot: false }));
      setTimeout(() => process.exit(0), 1500);
    },
  },
  {
    name: 'autobackup', pattern: 'autobackup', category: 'owner', owner: true, desc: 'Send yourself a backup every N hours', usage: 'autobackup <hours|off>',
    async handler(ctx) {
      const v = (ctx.args[0] || '').toLowerCase();
      if (v === 'off') { settings.set('autobackup', 0); return ctx.reply(ui.row('auto backup', 'off')); }
      const h = parseInt(v, 10);
      if (!(h >= 1 && h <= 720)) return native.buttons(ctx, { title: 'Auto backup', body: ui.card('Auto backup', [ui.row('now', settings.get('autobackup') ? 'every ' + settings.get('autobackup') + ' h' : 'off'), ui.small('A settings backup arrives in your DM on schedule')], { foot: false }), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'autobackup 12', text: 'Every 12 h' }, { id: ctx.prefix + 'autobackup 24', text: 'Daily' }, { id: ctx.prefix + 'autobackup off', text: 'Off' }] });
      settings.set('autobackup', h); settings.set('lastBackup', 0);
      await ctx.reply(ui.card('Auto backup', [ui.row('every', h + ' h'), ui.small('first one arrives within the hour')], { foot: false }));
    },
  },
];
