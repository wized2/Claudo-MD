# Claudo-MD

WhatsApp multi-device bot (Baileys) with native interactive menus, HTML mini apps and a reliable channel forwarder.

- Native buttons and lists everywhere. Every tap is a normal command, and `.ui text` switches to plain text if a client cannot render them
- Styled Unicode interface, no emoji
- Channel forwarding that does not miss posts: durable retry queue, lookback after downtime, media always re-sent, native "forwarded from channel" tag in `ocfwd` mode
- Playable HTML mini apps, group admin tools, downloaders and info lookups through keyless APIs
- `.stop` / `.start` idle switch, hot-reloading plugins

## Run
```
npm install
OWNER=923001234567 npm start
```
Open `http://localhost:3000`, enter your number and link with the pairing code.

Optional environment: `PUBLIC_URL` (adds a Play online button to games), `YT_API` and `YT_PROXY` (YouTube API base and fallback proxy), `PORT`, `SESSION_DIR`.

## Commands
| Category | Commands |
|---|---|
| Main | `.menu` `.usage <cmd>` `.alive` `.ping` `.id` |
| Mini apps | `.apps` `.games` `.play ttt\|snake\|2048\|memory\|quiz` `.ttt [bot]` `.guess` `.trivia` `.dice` `.coin` `.rps` `.calc` |
| Group (admin) | `.kick` `.add` `.promote` `.demote` `.tagall` `.hidetag` `.mute` `.unmute` `.link` `.revoke` `.ginfo` `.del` `.warn` `.warns [reset]` `.antilink off\|warn\|kick` `.welcome on\|off` |
| Download | `.yt <link or search>` `.song` `.video` `.ytget` `.tt <tiktok link>` |
| Info | `.weather` `.tr <lang> <text>` `.wiki` `.define` `.cur 100 usd pkr` |
| Tools | `.pfp <number>` (also reply or mention) `.qr` `.short` `.sticker` `.toimg` |
| Forwarding (owner) | `.cfwd help` `.cfwd add <channel link> <group jid\|here> [ocfwd]` `.cfwd list` `.cfwd mode` `.cfwd footer` `.cfwd strip` `.cfwd links on\|off` `.cfwd promo on\|off` `.cfwd test <text>` |
| Owner | `.stop` `.start [fresh]` `.status` `.ui native\|text` `.vv` |

## Mini apps
`.play <game>` sends a self-contained HTML file. Open it in the phone browser; it works offline and has on-screen buttons (no swiping needed). With `PUBLIC_URL` set the bot also serves them at `/games/<name>.html`.

## Plugin format
```js
module.exports = { name: 'hello', pattern: 'hello', aliases: [], category: 'main', desc: 'Say hi', direct: true, owner: false, group: false,
  async handler(ctx) { await ctx.reply('hi'); } };
```
`ctx` has `sock, m, jid, sender, args, arg, reply, isOwner, group, prefix, ui`. Use `lib/native.js` (`buttons`, `list`) for interactive replies, with a full command string as each button id. A file may export one plugin or an array.

## Tests
`npm test` (Node 18+). External APIs are mocked, so the suite runs offline.

## Notes
Native interactive messages are not an official API and WhatsApp may change how they render. Respect the terms of the services you download from.
