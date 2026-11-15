# Claudo-MD

WhatsApp multi-device bot (Baileys) with native interactive menus, mini apps and a reliable channel forwarder.

- Native buttons and lists everywhere; every tap is a normal command, and `.ui text` switches to plain text if a client cannot render them
- Styled Unicode interface, no emoji
- Channel forwarding that does not miss posts: durable retry queue, lookback after downtime, media always re-sent, native "forwarded from channel" tag in `ocfwd` mode
- Promo and invite detection (`.cfwd test <text>`)
- `.stop` / `.start` idle switch
- Hot-reloading plugins in `plugins/`

## Run
```bash
npm install
OWNER=923001234567 npm start
```
Open `http://localhost:3000`, enter your number and link with the pairing code.

### 24/7 Hosting (KataBump / Free VPS / PaaS)
Run with the built-in single-file supervisor which auto-restarts on crash and maintains state backups:
```bash
node katabump.js
```
State, routes, and credentials are automatically saved to `.claudo.backup.json` so you never lose your configuration or pairing on server reboot.

## Commands

### Main
| Command | Aliases | Description |
|---------|---------|-------------|
| `.menu [category]` | `help`, `commands`, `m` | Browse every command or a category |
| `.usage <cmd>` | | Show how a specific command works |
| `.alive` | `bot` | Bot status card with uptime |
| `.ping` | `p` | Latency and uptime |
| `.stats` | `system`, `sysinfo` | CPU, RAM, Node.js and process info |
| `.id` | `jid` | Your JID and chat JID |

### Apps / Mini Games
| Command | Aliases | Description |
|---------|---------|-------------|
| `.apps` | | Interactive mini apps launcher |
| `.dice [n]` | | Roll 1–6 dice |
| `.coin` | `flip` | Flip a coin |
| `.rps rock|paper|scissors` | | Rock paper scissors vs bot |
| `.calc <expr>` | `math` | Calculator — `calc 12*(3+4)` |
| `.ttt [bot|join|1-9|end]` | `tictactoe` | Tic tac toe (vs player or bot) |
| `.guess [number]` | | Guess the number 1–100 |
| `.trivia` | `quiz` | Multiple choice trivia question |
| `.quote` | `q`, `inspire` | Random inspirational quote |
| `.8ball <question>` | `ball`, `ask` | Ask the magic 8-ball |
| `.choose a | b | c` | `pick`, `or` | Randomly pick one of your options |

### Info
| Command | Aliases | Description |
|---------|---------|-------------|
| `.weather <city>` | `w`, `forecast` | Current weather + 3-day forecast |
| `.tr <lang> <text>` | `translate` | Translate text (reply or inline) |
| `.wiki <topic>` | | Wikipedia summary |
| `.dict <word>` | `define`, `d` | Dictionary: definition + example |
| `.cur <amt> <from> <to>` | `convert`, `currency` | Currency conversion — `cur 100 usd pkr` |

### Download
| Command | Aliases | Description |
|---------|---------|-------------|
| `.yt <url>` | | YouTube audio download |
| `.ytv <url>` | | YouTube video download |
| `.tt <url>` | `tiktok` | TikTok video download |

### Tools
| Command | Aliases | Description |
|---------|---------|-------------|
| `.qr <text>` | | Generate a QR code image |
| `.short <url>` | `shorten`, `tiny` | Shorten a URL |
| `.sticker` | `s`, `stick` | Convert image to sticker (reply to image) |
| `.toimg` | `unsticker` | Convert sticker to image |
| `.vv` | `viewonce` | Reveal a view-once photo or video (owner) |

### Group (admin only)
| Command | Description |
|---------|-------------|
| `.kick` | Remove a member |
| `.add <number>` | Add a member |
| `.promote` | Make admin |
| `.demote` | Remove admin |
| `.tagall [msg]` | Mention every member |
| `.hidetag [msg]` | Silent mention of everyone |
| `.mute` | Admins-only mode |
| `.unmute` | Open chat |
| `.link` | Get group invite link |
| `.revoke` | Reset invite link |
| `.ginfo` | Group details |
| `.del` | Delete a replied message |
| `.warn` | Warn a member (3 warns = remove) |
| `.warns [reset]` | View or clear warnings |
| `.antilink off|warn|kick` | Link protection |
| `.welcome on|off` | Welcome new members |

### Channel Forwarding
| Command | Description |
|---------|-------------|
| `.cfwd help` | Forwarding setup guide |
| `.cfwd add <channel_jid> <target_jid>` | Forward a channel to a group |
| `.cfwd list` | Show active routes |
| `.cfwd del <id>` | Remove a route |
| `.cfwd test <text>` | Test spam/promo detection |
| `.pfp <channel>` | Fetch channel profile picture |

### Owner / Control
| Command | Description |
|---------|-------------|
| `.stop` | Pause bot (ignore non-owner messages) |
| `.start` | Resume bot |
| `.status` | Show idle/running state |
| `.ui text|native` | Switch to plain text or native UI mode |
| `.reload` | Reload all plugins from disk |
| `.backup [send]` | Backup session and data into `.claudo.backup.json` (sends file in DM) |
| `.restore` | Restore state and session from `.claudo.backup.json` (or reply to file) |

## Plugin format
```js
module.exports = {
  name: 'hello',
  pattern: 'hello',
  aliases: [],
  category: 'main',
  desc: 'Say hi',
  usage: 'hello [name]',
  direct: true,   // respond in DMs
  owner: false,   // owner-only
  group: false,   // group-only
  async handler(ctx) {
    await ctx.reply('hi ' + (ctx.args[0] || 'there'));
  }
};
```

`ctx` has: `sock, m, jid, sender, args, arg, cmd, reply, isOwner, group, prefix, ui, startedAt, config, plugins`.  
Use `lib/native.js` (`buttons`, `list`) for interactive replies; use a full command string (e.g. `prefix + 'menu'`) as each button/row `id`.

## Environment variables
| Variable | Default | Description |
|----------|---------|-------------|
| `OWNER` | — | Your WhatsApp number with country code |
| `PAIR_NUMBER` | `OWNER` | Number to auto-pair on startup |
| `PORT` | `3000` | Web UI port |
| `PUBLIC_URL` | — | Externally reachable URL for QR endpoint |
| `SESSION_DIR` | `./session` | Where Baileys saves auth credentials |
| `BACKUP_FILE` | `.claudo.backup.json` | Path to persistent backup file |
| `ADMIN_PASSWORD` | — | Password for the web admin panel |
