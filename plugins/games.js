const native = require('../lib/native');
const ui = require('../lib/ui');
const sess = require('../lib/session');
const ttt = require('../lib/ttt');
const QUIZ = require('../lib/trivia');

const num = (s) => String(s || '').split('@')[0].split(':')[0];
const tag = (j) => '@' + num(j);

function freeRows(p, b) { return b.map((c, i) => (c ? null : { id: p + 'ttt ' + (i + 1), title: 'Cell ' + (i + 1), description: 'Place your mark' })).filter(Boolean); }

async function tttShow(ctx, g, note) {
  const p = ctx.prefix;
  const turnName = g.turn === 'X' ? g.x : g.o;
  const lines = ['```' + ttt.render(g.b) + '```', '', ui.row('✕', g.x === 'bot' ? 'bot' : tag(g.x)), ui.row('○', g.o === 'bot' ? 'bot' : tag(g.o)), note || ui.row('turn', turnName === 'bot' ? 'bot' : tag(turnName))];
  const mentions = [g.x, g.o].filter((x) => x && x !== 'bot');
  if (note) { await ctx.reply({ text: ui.card('Tic Tac Toe', lines, { foot: false }), mentions }); return; }
  await native.list(ctx, { title: 'Tic Tac Toe', body: ui.card('Tic Tac Toe', lines, { foot: false }), footer: 'Pick a cell', button: 'Place mark', sections: [{ title: 'Free cells', rows: freeRows(p, g.b) }] });
}

function finish(ctx, g, key) {
  const w = ttt.winner(g.b);
  if (w) { sess.del(key); return ui.row('winner', (w === 'X' ? g.x : g.o) === 'bot' ? 'bot' : tag(w === 'X' ? g.x : g.o)); }
  if (ttt.full(g.b)) { sess.del(key); return ui.row('result', 'draw'); }
  return null;
}

const pick = () => Math.floor(Math.random() * QUIZ.length);

module.exports = [
  {
    name: 'ttt', pattern: 'ttt', aliases: ['tictactoe'], category: 'apps', desc: 'Tic tac toe: ttt, ttt bot, ttt join, ttt <1-9>', usage: 'ttt [bot|join|1-9|end]', direct: false,
    async handler(ctx) {
      const p = ctx.prefix; const key = 'ttt:' + ctx.jid; const sub = (ctx.args[0] || '').toLowerCase();
      let g = sess.get(key);
      if (sub === 'end') { sess.del(key); return ctx.reply(ui.small('game ended')); }
      if (!sub || sub === 'bot') {
        if (g) return ctx.reply(ui.small('a game is running. ' + p + 'ttt end to stop it'));
        g = { b: Array(9).fill(null), x: ctx.sender, o: sub === 'bot' ? 'bot' : null, turn: 'X' };
        sess.set(key, g);
        if (g.o) return tttShow(ctx, g);
        return native.buttons(ctx, { title: 'Tic Tac Toe', body: ui.card('Tic Tac Toe', [tag(ctx.sender) + ' wants to play.', ui.small('Tap Join to be the second player')], { foot: false }), footer: ctx.config.botName, buttons: [{ id: p + 'ttt join', text: 'Join' }, { id: p + 'ttt bot', text: 'Play bot' }] });
      }
      if (!g) return ctx.reply(ui.small('no game. start with ' + p + 'ttt'));
      if (sub === 'join') {
        if (g.o) return ctx.reply(ui.small('game already has two players'));
        if (num(ctx.sender) === num(g.x)) return ctx.reply(ui.small('you started it. wait for an opponent or use ' + p + 'ttt bot'));
        g.o = ctx.sender; return tttShow(ctx, g);
      }
      const n = parseInt(sub, 10);
      if (!(n >= 1 && n <= 9)) return ctx.reply(ui.small('cell 1 to 9'));
      if (!g.o) return ctx.reply(ui.small('waiting for an opponent'));
      const who = g.turn === 'X' ? g.x : g.o;
      if (num(who) !== num(ctx.sender)) return ctx.reply(ui.small('not your turn'));
      if (g.b[n - 1]) return ctx.reply(ui.small('cell taken'));
      g.b[n - 1] = g.turn; g.turn = g.turn === 'X' ? 'O' : 'X'; sess.touch(key);
      let end = finish(ctx, g, key);
      if (!end && (g.turn === 'X' ? g.x : g.o) === 'bot') {
        g.b[ttt.bestMove(g.b, g.turn)] = g.turn; g.turn = g.turn === 'X' ? 'O' : 'X';
        end = finish(ctx, g, key);
      }
      return tttShow(ctx, g, end);
    },
  },
  {
    name: 'guess', pattern: 'guess', category: 'apps', desc: 'Guess the number 1 to 100', usage: 'guess [number]',
    async handler(ctx) {
      const key = 'guess:' + ctx.jid + ':' + num(ctx.sender); let g = sess.get(key); const a = ctx.args[0];
      if (!a || !g) { g = sess.set(key, { n: 1 + Math.floor(Math.random() * 100), tries: 0 }); if (!a) return ctx.reply(ui.card('Guess', [ui.small('I picked a number from 1 to 100'), ui.cmd(ctx.prefix, 'guess 50')], { foot: false })); }
      const v = parseInt(a, 10);
      if (!(v >= 1 && v <= 100)) return ctx.reply(ui.small('a number from 1 to 100'));
      g.tries++;
      if (v === g.n) { sess.del(key); return ctx.reply(ui.card('Correct', [ui.row('number', g.n), ui.row('tries', g.tries)], { foot: false })); }
      const close = 1 - Math.abs(v - g.n) / 100;
      await ctx.reply(ui.card(v < g.n ? 'Higher' : 'Lower', [ui.meter(close), ui.row('tries', g.tries)], { foot: false }));
    },
  },
  {
    name: 'trivia', pattern: 'trivia', aliases: ['quiz'], category: 'apps', desc: 'Multiple choice quiz', usage: 'trivia',
    async handler(ctx) {
      const p = ctx.prefix; const key = 'trivia:' + ctx.jid; const a = ctx.args;
      if (a[0] === 'a' && a[1] != null) {
        const q = sess.get(key); if (!q) return ctx.reply(ui.small('no open question. ' + p + 'trivia'));
        sess.del(key); const ok = parseInt(a[1], 10) === q.ans;
        return native.buttons(ctx, { title: ok ? 'Correct' : 'Wrong', body: ui.card(ok ? 'Correct' : 'Wrong', [ui.row('answer', q.opts[q.ans])], { foot: false }), footer: ctx.config.botName, buttons: [{ id: p + 'trivia', text: 'Next question' }] });
      }
      const [text, opts, ans] = QUIZ[pick()];
      sess.set(key, { opts, ans });
      await native.list(ctx, { title: 'Trivia', body: ui.card('Trivia', [ui.bold(text)], { foot: false }), footer: 'Choose an answer', button: 'Answer', sections: [{ title: 'Options', rows: opts.map((o, i) => ({ id: p + 'trivia a ' + i, title: o, description: '' })) }] });
    },
  },
];
