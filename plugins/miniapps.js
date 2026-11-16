const fs = require('fs');
const path = require('path');
const native = require('../lib/native');
const { sendHtmlApp } = require('../lib/htmlTransport');
const ui = require('../lib/ui');

const DIR = path.join(__dirname, '..', 'public', 'mini');
// Self-contained tools: everything runs on the phone, no data exchange with the bot.
const APPS = {
  calc: ['Calculator', 'Full keypad with brackets and percent'],
  clock: ['Stopwatch and Timer', 'Laps, presets, alarm sound'],
  tip: ['Tip and Split', 'Share a bill between people'],
  units: ['Unit Converter', 'Length, weight, volume, speed, data, area, temp'],
  pass: ['Password Maker', 'Strong random passwords, made on your device'],
  bmi: ['BMI Calculator', 'Metric or imperial, with a colour scale'],
  age: ['Age Calculator', 'Exact age and days to next birthday'],
  counter: ['Tally Counter', 'Big tap button with best score'],
  dice: ['Dice Roller', 'd4 to d100, up to 10 dice'],
  sci: ['Scientific Calculator', 'Trig, logs, powers, factorial, DEG/RAD'],
  color: ['Color Picker', 'Tap hues, get HEX, RGB and HSL'],
  decide: ['Decision Wheel', 'Cannot choose? Let luck pick'],
};
const ALIAS = { calculator: 'calc', stopwatch: 'clock', timer: 'clock', split: 'tip', convert: 'units', converter: 'units', password: 'pass', passgen: 'pass', tally: 'counter', roll: 'dice', dice: 'dice', scientific: 'sci', colour: 'color', wheel: 'decide', pick: 'decide' };

module.exports = [
  {
    name: 'mini', pattern: 'mini', aliases: ['tools2', 'miniapps'], category: 'apps', desc: 'Offline mini apps: calculator, timer, converter', usage: 'mini [calc|clock|tip|units|pass|bmi|age|counter|dice|sci|color|decide] [file]', direct: true,
    async handler(ctx) {
      const p = ctx.prefix;
      let k = (ctx.args[0] || '').toLowerCase(); k = ALIAS[k] || k;
      if (!APPS[k]) {
        const rows = Object.entries(APPS).map(([id, [t, d]]) => ({ id: p + 'mini ' + id, title: t, description: d }));
        const lines = Object.entries(APPS).map(([id, [t, d]]) => ui.cmd(p, 'mini ' + id, d));
        return native.list(ctx, { title: 'Mini apps', body: ui.card('Mini apps', [ui.small('Work fully on your phone, no internet needed.'), '', ...lines], { foot: false }), footer: ctx.config.botName, button: 'Pick an app', sections: [{ title: 'Offline tools', rows }] });
      }
      const file = path.join(DIR, k + '.html');
      if (!fs.existsSync(file)) return ctx.reply(ui.small('app file missing'));
      const [title, desc] = APPS[k];
      const html = fs.readFileSync(file, 'utf8');
      let inChat = false;
      if ((ctx.args[1] || '').toLowerCase() !== 'file') {
        try { await sendHtmlApp(ctx.sock, ctx.jid, html, title); inChat = true; } catch (e) { console.warn('[mini] in-chat failed:', e.message || e); }
      }
      if (!inChat) {
        return ctx.reply({ document: Buffer.from(html), mimetype: 'text/html', fileName: title + '.html', caption: ui.card(title, [ui.small(desc), '', ui.small('Open the file in your browser. It works offline.')], { foot: false }) });
      }
      await native.buttons(ctx, { title, body: ui.small(title + ' is open above. Tap Send as file to keep a copy.'), footer: ctx.config.botName, buttons: [{ id: p + 'mini ' + k + ' file', text: 'Send as file' }, { id: p + 'mini', text: 'All apps' }] });
    },
  },
];
