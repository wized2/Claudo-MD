const native = require('../lib/native');
const ui = require('../lib/ui');

const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

const QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['In the middle of every difficulty lies opportunity.', 'Albert Einstein'],
  ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
  ['Life is what happens when you are busy making other plans.', 'John Lennon'],
  ['The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt'],
  ['It is during our darkest moments that we must focus to see the light.', 'Aristotle'],
  ['Spread love everywhere you go. Let no one ever come to you without leaving happier.', 'Mother Teresa'],
  ['When you reach the end of your rope, tie a knot in it and hang on.', 'Franklin D. Roosevelt'],
  ['Always remember that you are absolutely unique. Just like everyone else.', 'Margaret Mead'],
  ['Do not go where the path may lead, go instead where there is no path and leave a trail.', 'Ralph Waldo Emerson'],
  ['You will face many defeats in life, but never let yourself be defeated.', 'Maya Angelou'],
  ['The greatest glory in living lies not in never falling, but in rising every time we fall.', 'Nelson Mandela'],
  ['In the end, it is not the years in your life that count. It is the life in your years.', 'Abraham Lincoln'],
  ['Never let the fear of striking out keep you from playing the game.', 'Babe Ruth'],
  ['Life is either a daring adventure or nothing at all.', 'Helen Keller'],
];

const BALL_ANSWERS = [
  'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes, definitely.', 'You may rely on it.',
  'As I see it, yes.', 'Most likely.', 'Outlook good.', 'Yes.', 'Signs point to yes.',
  'Reply hazy, try again.', 'Ask again later.', 'Better not tell you now.', 'Cannot predict now.', 'Concentrate and ask again.',
  'Do not count on it.', 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.',
];

module.exports = [
  {
    name: 'quote', pattern: 'quote', aliases: ['q', 'inspire'], category: 'apps', desc: 'Random inspirational quote', direct: true,
    async handler(ctx) {
      const [text, author] = pickOne(QUOTES);
      await native.buttons(ctx, {
        title: 'Quote',
        body: ui.card('Quote', [ui.bold('"' + text + '"'), '', ui.small('— ' + author)], { foot: false }),
        footer: ctx.config.botName,
        buttons: [{ id: ctx.prefix + 'quote', text: 'Another' }, { id: ctx.prefix + 'apps', text: 'Apps' }],
      });
    },
  },
  {
    name: '8ball', pattern: '8ball', aliases: ['ball', 'ask'], category: 'apps', desc: 'Ask the magic 8-ball a yes/no question', usage: '8ball will it rain today?', direct: true,
    async handler(ctx) {
      const q = ctx.args.join(' ').trim();
      if (!q) return ctx.reply(ui.card('8-Ball', [ui.small('ask a yes/no question'), ui.cmd(ctx.prefix, '8ball will it rain today?')], { foot: false }));
      const answer = pickOne(BALL_ANSWERS);
      const tone = BALL_ANSWERS.indexOf(answer) < 10 ? 'Yes' : BALL_ANSWERS.indexOf(answer) < 15 ? 'Maybe' : 'No';
      await native.buttons(ctx, {
        title: 'Magic 8-Ball',
        body: ui.card('Magic 8-Ball', [ui.small(q), '', ui.bold(answer), '', ui.row('verdict', tone)], { foot: false }),
        footer: ctx.config.botName,
        buttons: [{ id: ctx.prefix + '8ball ' + q, text: 'Ask again' }, { id: ctx.prefix + 'apps', text: 'Apps' }],
      });
    },
  },
  {
    name: 'choose', pattern: 'choose', aliases: ['pick', 'or'], category: 'apps', desc: 'Pick one option (separate with |)', usage: 'choose pizza | burger | sushi', direct: true,
    async handler(ctx) {
      const raw = ctx.args.join(' ');
      const opts = raw.split('|').map((s) => s.trim()).filter(Boolean);
      if (opts.length < 2) return ctx.reply(ui.card('Choose', [ui.small('give at least 2 options separated by |'), ui.cmd(ctx.prefix, 'choose pizza | burger | sushi')], { foot: false }));
      const chosen = pickOne(opts);
      await native.buttons(ctx, {
        title: 'Decision made',
        body: ui.card('I choose', [ui.bold(chosen), '', ...opts.map((o) => ui.item(o === chosen ? ui.bold(o) + '  ✓' : o))], { foot: false }),
        footer: ctx.config.botName,
        buttons: [{ id: ctx.prefix + 'choose ' + raw, text: 'Decide again' }, { id: ctx.prefix + 'apps', text: 'Apps' }],
      });
    },
  },
];
