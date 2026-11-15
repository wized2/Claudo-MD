const backup = require('../lib/backup');
const media = require('../lib/media');
const ui = require('../lib/ui');

module.exports = [
  {
    name: 'backup', pattern: 'backup', aliases: ['exportbackup', 'bkp'], category: 'owner', owner: true, desc: 'Backup session and data to a file', usage: 'backup [send]', direct: true,
    async handler(ctx) {
      try {
        const res = backup.createBackup();
        const sendDoc = (ctx.args[0] || '').toLowerCase() === 'send' || !ctx.group;
        const msg = [
          ui.row('file', '.claudo.backup.json'),
          ui.row('data files', res.dataFiles),
          ui.row('session files', res.sessionFiles),
          ui.row('size', (res.size / 1024).toFixed(1) + ' KB'),
          '',
          ui.small('Saved on server. Use ".restore" or reply to this file with ".restore" to load.'),
        ];

        if (sendDoc) {
          await ctx.sock.sendMessage(ctx.jid, {
            document: res.buffer,
            mimetype: 'application/json',
            fileName: '.claudo.backup.json',
            caption: ui.card('Backup created', msg, { foot: false }),
          }, { quoted: ctx.m });
        } else {
          await ctx.reply(ui.card('Backup created', msg, { foot: false }));
        }
      } catch (e) {
        await ctx.reply(ui.small('backup failed: ' + (e.message || e)));
      }
    },
  },
  {
    name: 'restore', pattern: 'restore', category: 'owner', owner: true, desc: 'Restore data and session from backup file', usage: 'restore (reply to .claudo.backup.json)', direct: true,
    async handler(ctx) {
      try {
        const f = media.findMedia(ctx.m);
        if (f && f.kind === 'document') {
          const buf = await media.download(ctx.sock, f);
          const res = backup.restoreBackup(buf);
          return ctx.reply(ui.card('Restored from attachment', [
            ui.row('created at', res.createdAt || 'unknown'),
            ui.row('data files', res.restoredData),
            ui.row('session files', res.restoredSession),
            '',
            ui.small('Restart the bot or run .reload to take full effect.'),
          ], { foot: false }));
        }

        // Otherwise restore from server local .claudo.backup.json
        const res = backup.restoreBackup();
        await ctx.reply(ui.card('Restored from server backup', [
          ui.row('created at', res.createdAt || 'unknown'),
          ui.row('data files', res.restoredData),
          ui.row('session files', res.restoredSession),
          '',
          ui.small('Restart the bot or run .reload to take full effect.'),
        ], { foot: false }));
      } catch (e) {
        await ctx.reply(ui.small('restore failed: ' + (e.message || e)));
      }
    },
  },
];
