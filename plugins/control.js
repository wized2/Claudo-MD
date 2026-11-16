const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execAsync = promisify(exec);
const botState = require('../lib/botState');
const engine = require('../lib/cfwdEngine');
const channelPoll = require('../lib/channelPoll');
const settings = require('../lib/settings');
const ui = require('../lib/ui');
const { loadPlugins } = require('../lib/pluginLoader');

const ago = (ms) => {
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 90) return s + 's';
  if (s < 5400) return Math.round(s / 60) + 'm';
  return Math.round(s / 3600) + 'h';
};

function checkPassword(config, args) {
  const expected = String((config && config.adminPassword) || process.env.ADMIN_PASSWORD || '0980');
  const given = String(args[0] || '').trim();
  return given && given === expected;
}

function needPw(ctx, cmd) {
  return ctx.reply(ui.card('Password required', [ui.small('Usage: ' + ctx.prefix + cmd + ' <password>')]));
}

module.exports = [
  {
    name: 'stop',
    pattern: 'stop',
    aliases: ['idle', 'pause'],
    category: 'owner',
    owner: true,
    desc: 'Stop all bot work and go idle',
    async handler(ctx) {
      const changed = botState.setIdle(true, ctx.sender);
      engine.flush();
      await ctx.reply(
        ui.card('Idle', [
          changed ? 'All work paused. Only owner controls answer.' : 'Already idle.',
          '',
          ui.row('resume', ctx.prefix + 'start'),
        ])
      );
    },
  },
  {
    name: 'start',
    pattern: 'start',
    aliases: ['resume', 'wake'],
    category: 'owner',
    owner: true,
    desc: 'Resume; "start fresh" skips missed posts',
    usage: 'start [fresh]',
    async handler(ctx) {
      const fresh = (ctx.args[0] || '').toLowerCase() === 'fresh';
      if (fresh) engine.skipToNow();
      const changed = botState.setIdle(false, ctx.sender);
      await ctx.reply(
        ui.card('Running', [
          changed ? 'Back online.' : 'Already running.',
          fresh ? 'Posts made while idle were skipped.' : 'Posts missed while idle will be caught up.',
        ])
      );
    },
  },
  {
    name: 'status',
    pattern: 'status',
    aliases: ['botstatus'],
    category: 'owner',
    owner: true,
    desc: 'Bot and forward queue status',
    direct: true,
    async handler(ctx) {
      const st = botState.getState();
      const e = engine.status();
      const scans = Object.entries(e.scans || {}).map(([j, x]) =>
        ui.item(j.slice(0, 10) + '  ' + ago(x.at) + ' ago  ' + (x.err ? ui.small(x.err) : x.count + ' fetched'))
      );
      await ctx.reply(
        ui.card('Status', [
          ui.row('state', st.idle ? 'idle for ' + ago(st.since) : 'running'),
          ui.row('channels', e.channels),
          ui.row('queue', e.pending),
          ui.row('failed', e.failed.length),
          ...scans,
          ...e.failed.map((f) => ui.item(f.to + ': ' + f.error)),
        ])
      );
    },
  },
  {
    name: 'ui',
    pattern: 'ui',
    category: 'owner',
    owner: true,
    desc: 'Switch native buttons or plain text',
    usage: 'ui native|text',
    async handler(ctx) {
      const v = (ctx.args[0] || '').toLowerCase();
      if (v !== 'native' && v !== 'text') {
        return ctx.reply(
          ui.row('interface', settings.get('native') === false ? 'text' : 'native') +
            '\n' +
            ui.small(ctx.prefix + 'ui native|text')
        );
      }
      settings.set('native', v === 'native');
      await ctx.reply(ui.row('interface', v));
    },
  },

  // —— admin (password) — same idea as MiniBot channel-forward ——
  {
    name: 'restart',
    pattern: 'restart',
    aliases: ['reboot'],
    category: 'owner',
    owner: true,
    desc: 'Restart bot process (password)',
    usage: 'restart <password>',
    async handler(ctx) {
      if (!checkPassword(ctx.config, ctx.args)) return needPw(ctx, 'restart');
      await ctx.reply('Restarting…');
      setTimeout(() => process.exit(0), 400);
    },
  },
  {
    name: 'checkupdate',
    pattern: 'checkupdate',
    aliases: ['check', 'cu', 'updatecheck'],
    category: 'owner',
    owner: true,
    desc: 'Check for git updates (password)',
    usage: 'checkupdate <password>',
    async handler(ctx) {
      if (!checkPassword(ctx.config, ctx.args)) return needPw(ctx, 'checkupdate');
      const root = path.join(__dirname, '..');
      try {
        await ctx.reply('Checking for updates…');
        try {
          await execAsync('git fetch --depth 1 origin', { cwd: root, timeout: 90000 });
        } catch (fe) {
          console.warn('[checkupdate] fetch', fe.message || fe);
        }
        const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', {
          cwd: root,
          timeout: 15000,
        });
        const branch = String(branchOut || 'HEAD').trim();
        const { stdout: localOut } = await execAsync('git rev-parse HEAD', {
          cwd: root,
          timeout: 15000,
        });
        const local = String(localOut || '').trim();
        let remote = '';
        try {
          const { stdout: remoteOut } = await execAsync('git rev-parse origin/' + branch, {
            cwd: root,
            timeout: 15000,
          });
          remote = String(remoteOut || '').trim();
        } catch (_) {
          try {
            const { stdout: remoteOut } = await execAsync('git rev-parse @{u}', {
              cwd: root,
              timeout: 15000,
            });
            remote = String(remoteOut || '').trim();
          } catch (e2) {
            await ctx.reply(
              '*Update check*\nBranch: `' +
                branch +
                '`\nLocal: `' +
                local.slice(0, 7) +
                '`\nRemote tracking branch not found. Run from a git clone with `origin`.'
            );
            return;
          }
        }
        if (local === remote) {
          await ctx.reply(
            '*Up to date*\nBranch: `' +
              branch +
              '`\nCommit: `' +
              local.slice(0, 7) +
              '`\n\nNo new commits on origin.'
          );
          return;
        }
        let log = '';
        try {
          const { stdout: logOut } = await execAsync(
            'git log --oneline ' + local.slice(0, 7) + '..' + remote.slice(0, 7),
            { cwd: root, timeout: 15000 }
          );
          log = String(logOut || '').trim().slice(0, 1200);
        } catch (_) {}
        await ctx.reply(
          '*Update available*\nBranch: `' +
            branch +
            '`\nLocal:  `' +
            local.slice(0, 7) +
            '`\nRemote: `' +
            remote.slice(0, 7) +
            '`\n' +
            (log ? '\nNew commits:\n```\n' + log + '\n```\n' : '\n') +
            '\nApply with:\n`' +
            ctx.prefix +
            'update <password>`'
        );
      } catch (e) {
        await ctx.reply('Check failed:\n' + (e.message || e));
      }
    },
  },
  {
    name: 'update',
    pattern: 'update',
    aliases: ['upgrade', 'pull'],
    category: 'owner',
    owner: true,
    desc: 'git pull then restart (password)',
    usage: 'update <password>',
    async handler(ctx) {
      if (!checkPassword(ctx.config, ctx.args)) return needPw(ctx, 'update');
      await ctx.reply('Updating from git…');
      const root = path.join(__dirname, '..');
      try {
        const { stdout, stderr } = await execAsync('git pull --ff-only', {
          cwd: root,
          timeout: 120000,
        });
        await ctx.reply(
          '*git pull*\n```\n' +
            String(stdout || stderr || 'ok').slice(0, 1500) +
            '\n```\nRestarting…'
        );
      } catch (e) {
        await ctx.reply(
          'Update failed:\n' + e.message + '\nStill restarting so supervisor can recover.'
        );
      }
      setTimeout(() => process.exit(0), 800);
    },
  },
  {
    name: 'refresh',
    pattern: 'refresh',
    aliases: ['reload'],
    category: 'owner',
    owner: true,
    desc: 'Reload plugins + resubscribe channels (password)',
    usage: 'refresh <password>',
    async handler(ctx) {
      if (!checkPassword(ctx.config, ctx.args)) return needPw(ctx, 'refresh');
      try {
        for (const key of Object.keys(require.cache)) {
          if (
            key.includes(path.sep + 'plugins' + path.sep) ||
            key.includes(path.sep + 'lib' + path.sep + 'cfwd') ||
            key.includes(path.sep + 'lib' + path.sep + 'forward') ||
            key.includes(path.sep + 'lib' + path.sep + 'channel')
          ) {
            delete require.cache[key];
          }
        }
        if (typeof global.reloadPlugins === 'function') {
          global.reloadPlugins();
        } else {
          loadPlugins(path.join(__dirname));
        }
        if (channelPoll.refreshSubscriptions) channelPoll.refreshSubscriptions();
        if (ctx.sock && channelPoll.tick) await channelPoll.tick();
        await ctx.reply('Refreshed plugins, channel subscriptions, and ran a poll tick.');
      } catch (e) {
        await ctx.reply('Refresh error: ' + e.message);
      }
    },
  },
];
