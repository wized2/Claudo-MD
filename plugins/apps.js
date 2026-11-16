const native = require('../lib/native');
const ui = require('../lib/ui');

const rnd = (n) => Math.floor(Math.random() * n);
const pickOne = (a) => a[rnd(a.length)];
const FACE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function calc(expr) {
  const e = String(expr).replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/,/g, '');
  if (!/^[\d\s+\-*/%().]+$/.test(e)) throw new Error('numbers and + - * / % ^ ( ) only');
  const v = Function('"use strict";return (' + e + ')')();
  if (!Number.isFinite(v)) throw new Error('not a number');
  return Math.round(v * 1e10) / 1e10;
}

module.exports = [
  {
    name: 'apps', pattern: 'apps', aliases: ['miniapps'], category: 'apps', desc: 'Mini apps launcher', direct: true,
    async handler(ctx) {
      const p = ctx.prefix;
      await native.list(ctx, {
        title: 'Mini apps', body: ui.card('Mini apps', [ui.small('Tap an app. Each one keeps its own buttons.')], { foot: false }), footer: ctx.config.botName, button: 'Open an app',
        sections: [{ title: 'Apps', rows: [
          { id: p + 'dice', title: 'Dice', description: 'Roll one or more dice' },
          { id: p + 'coin', title: 'Coin', description: 'Heads or tails' },
          { id: p + 'rps', title: 'Rock paper scissors', description: 'Play against the bot' },
          { id: p + 'usage calc', title: 'Calculator', description: p + 'calc 12*(3+4)' },
        ] }],
      });
    },
  },
  {
    name: 'dice', pattern: 'dice', aliases: ['roll'], category: 'apps', desc: 'Roll dice', usage: 'dice [count]', direct: true,
    async handler(ctx) {
      const n = Math.max(1, Math.min(6, parseInt(ctx.args[0], 10) || 1));
      const rolls = Array.from({ length: n }, () => rnd(6));
      await native.buttons(ctx, {
        title: 'Dice', body: ui.card('Dice', [rolls.map((r) => FACE[r]).join('  '), ui.row('total', rolls.reduce((a, b) => a + b + 1, 0))], { foot: false }), footer: ctx.config.botName,
        buttons: [{ id: ctx.prefix + 'dice ' + n, text: 'Roll again' }, { id: ctx.prefix + 'dice ' + Math.min(6, n + 1), text: 'Add a die' }, { id: ctx.prefix + 'apps', text: 'Apps' }],
      });
    },
  },
  {
    name: 'coin', pattern: 'coin', aliases: ['flip'], category: 'apps', desc: 'Flip a coin', direct: true,
    async handler(ctx) {
      await native.buttons(ctx, { title: 'Coin', body: ui.card('Coin', [ui.bold(pickOne(['Heads', 'Tails']))], { foot: false }), footer: ctx.config.botName, buttons: [{ id: ctx.prefix + 'coin', text: 'Flip again' }, { id: ctx.prefix + 'apps', text: 'Apps' }] });
    },
  },
  {
    name: 'rps', pattern: 'rps', category: 'apps', desc: 'Rock paper scissors', usage: 'rps rock|paper|scissors', direct: true,
    async handler(ctx) {
      const p = ctx.prefix, opts = ['rock', 'paper', 'scissors'], me = (ctx.args[0] || '').toLowerCase();
      if (!opts.includes(me)) {
        return native.buttons(ctx, { title: 'Rock paper scissors', body: ui.card('Your move', [ui.small('Choose one')], { foot: false }), footer: ctx.config.botName, buttons: opts.map((o) => ({ id: p + 'rps ' + o, text: o[0].toUpperCase() + o.slice(1) })) });
      }
      const bot = pickOne(opts), win = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
      const res = me === bot ? 'Draw' : win[me] === bot ? 'You win' : 'Bot wins';
      await native.buttons(ctx, { title: res, body: ui.card(res, [ui.row('you', me), ui.row('bot', bot)], { foot: false }), footer: ctx.config.botName, buttons: [{ id: p + 'rps', text: 'Play again' }, { id: p + 'apps', text: 'Apps' }] });
    },
  },
  {
    name: 'calc', pattern: 'calc', aliases: ['math'], category: 'apps', desc: 'Calculator', usage: 'calc 12*(3+4)',
    async handler(ctx) {
      try {
        await ctx.reply(ui.card('Calculator', [ui.row('expr', ctx.arg), ui.row('result', ui.bold(String(calc(ctx.arg))))]));
      } catch (e) { await ctx.reply(ui.note(e.message)); }
    },
  },
];
