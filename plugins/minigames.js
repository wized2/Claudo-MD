const fs = require('fs');
const path = require('path');
const native = require('../lib/native');
const ui = require('../lib/ui');

const DIR = path.join(__dirname, '..', 'public', 'games');
const GAMES = {
  ttt: ['Tic Tac Toe', 'Beat the bot, three levels'],
  snake: ['Snake', 'Swipe to steer, eat, grow'],
  '2048': ['2048', 'Merge tiles to reach 2048'],
  memory: ['Memory', 'Match all the pairs'],
  quiz: ['Quiz', '10 timed questions'],
};

module.exports = [
  {
    name: 'games', pattern: 'games', aliases: ['arcade'], category: 'apps', desc: 'Playable HTML mini apps', usage: 'games', direct: true,
    async handler(ctx) {
      const p = ctx.prefix;
      const rows = Object.entries(GAMES).map(([k, [t, d]]) => ({ id: p + 'play ' + k, title: t, description: d }));
      const lines = Object.entries(GAMES).map(([k, [t, d]]) => ui.cmd(p, 'play ' + k, d));
      await native.list(ctx, { title: 'Arcade', body: ui.card('Arcade', [ui.small('Each game is a mini app. Open the file in your browser.'), '', ...lines], { foot: false }), footer: ctx.config.botName, button: 'Pick a game', sections: [{ title: 'Mini apps', rows }] });
    },
  },
  {
    name: 'play', pattern: 'play', category: 'apps', desc: 'Send a game as a mini app', usage: 'play ttt|snake|2048|memory|quiz',
    async handler(ctx) {
      const p = ctx.prefix; const k = (ctx.args[0] || '').toLowerCase();
      if (!GAMES[k]) return ctx.reply(ui.card('Play', [ui.small('choose one of:'), ...Object.keys(GAMES).map((x) => ui.cmd(p, 'play ' + x))], { foot: false }));
      const file = path.join(DIR, k + '.html');
      if (!fs.existsSync(file)) return ctx.reply(ui.small('game file missing'));
      const [title, desc] = GAMES[k];
      await ctx.reply({ document: fs.readFileSync(file), mimetype: 'text/html', fileName: title + '.html', caption: ui.card(title, [ui.small(desc), '', ui.small('Open the file in your browser to play. It works offline.')], { foot: false }) });
      const base = ctx.config.publicUrl;
      if (base) {
        const url = base + '/games/' + k + '.html';
        await native.buttons(ctx, { title, body: ui.card(title, [ui.small('or play online')], { foot: false }), footer: ctx.config.botName, buttons: [{ text: 'Play online', url }, { id: p + 'games', text: 'All games' }] });
      }
    },
  },
];
