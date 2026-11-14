# Claudo-MD

WhatsApp multi-device bot (Baileys) with native interactive menus, mini apps and a reliable channel forwarder.

- Native buttons and lists everywhere; every tap is a normal command, and `.ui text` switches to plain text if a client cannot render them
- Styled Unicode interface, no emoji
- Channel forwarding that does not miss posts: durable retry queue, lookback after downtime, media always re-sent, native "forwarded from channel" tag in `ocfwd` mode
- Promo and invite detection (`.cfwd test <text>`)
- `.stop` / `.start` idle switch
- Hot-reloading plugins in `plugins/`

## Run
```
npm install
OWNER=923001234567 npm start
```
Open `http://localhost:3000`, enter your number and link with the pairing code.

## Commands (batch 1)
`.menu` `.alive` `.ping` `.id` `.apps` `.dice` `.coin` `.rps` `.calc` `.cfwd help` `.stop` `.start` `.status` `.ui`

## Plugin format
```js
module.exports = { name: 'hello', pattern: 'hello', aliases: [], category: 'main', desc: 'Say hi', direct: true, owner: false,
  async handler(ctx) { await ctx.reply('hi'); } };
```
`ctx` has `sock, m, jid, sender, args, arg, reply, isOwner, group, prefix, ui`. Use `lib/native.js` (`buttons`, `list`) for interactive replies; use a full command string as each button id.
