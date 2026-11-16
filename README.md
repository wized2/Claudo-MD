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


## Backup and restore (owner)

| Command | What it does |
|---|---|
| `.backup` | Sends a JSON file with rules, settings, warnings, protection (no login) |
| `.backup full` | Same plus the WhatsApp login so you can skip pairing. Keep it private |
| `.restore [full]` | Reply to a backup file. The bot restarts to apply it |
| `.autobackup <hours\|off>` | Sends a settings backup to your DM on a schedule |

## KataBump / panel hosting

Copy `katabump.js` to the host root as `index.js`. It clones this repo into `bot/`, keeps `data/` and `session/` outside it, auto-updates every 5 min, and restarts the bot on exit. Env: `PHONE`, `PORT`, `BRANCH`, `REPO_URL`, `UPDATE_EVERY_MIN`. To restore on a fresh host, upload a `claudo-backup-*.json` to the host root before first start (used only when `data/` is empty; `session/` is restored only if empty).

## Offline mini apps
`.mini` opens a list. `.mini calc|clock|tip|units|pass|bmi|age|counter|dice|sci|color|decide` sends a self-contained HTML app (calculator, stopwatch and timer, tip split, unit converter, password maker, BMI, age, tally counter, dice). Every control is a tap button, none needs swiping. They need no data from the bot or internet; if the in-chat render is unsupported the app is sent as an `.html` file.

## Settings (owner)
`.settings` opens a tap list: **mode** public/private (private = only you can use commands), **auto read**, **typing status**, **anti call** (rejects calls with a note) and **anti delete** (forwards deleted messages to your DM, for messages the bot has seen since it started). Also `.settings <feature> on|off`.

## APK downloads
`.apk <name>` searches Aptoide (keyless public API) and shows a tap list. Picking one runs `.apkget <package>`, which sends the APK as a document (with version, size, developer, scan status). Files over `APK_MAX_MB` (default 100) get a direct link button instead. Apps with OBB data are flagged. Set `APTOIDE_API` to use another endpoint.
