/** Text UI kit: stylish Unicode, no emoji. */
const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const a = 'abcdefghijklmnopqrstuvwxyz';
const D = '0123456789';

function mapper(upper, lower, digit) {
  const U = [...upper], L = [...lower], N = digit ? [...digit] : null;
  return (s) =>
    [...String(s)]
      .map((c) => {
        const i = A.indexOf(c), j = a.indexOf(c), k = D.indexOf(c);
        if (i >= 0) return U[i];
        if (j >= 0) return L[j];
        if (k >= 0 && N) return N[k];
        return c;
      })
      .join('');
}

const bold = mapper('𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭', '𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇', '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵');
const mono = mapper('𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉', '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣', '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿');
const script = mapper('𝓐𝓑𝓒𝓓𝓔𝓕𝓖𝓗𝓘𝓙𝓚𝓛𝓜𝓝𝓞𝓟𝓠𝓡𝓢𝓣𝓤𝓥𝓦𝓧𝓨𝓩', '𝓪𝓫𝓬𝓭𝓮𝓯𝓰𝓱𝓲𝓳𝓴𝓵𝓶𝓷𝓸𝓹𝓺𝓻𝓼𝓽𝓾𝓿𝔀𝔁𝔂𝔃');
const SC = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ';
const small = (s) => [...String(s)].map((c) => { const j = a.indexOf(c.toLowerCase()); return j >= 0 ? [...SC][j] : c; }).join('');

const W = 24;
const bar = '─'.repeat(W);

/** Open title line (used by plain fallbacks). */
function header(title, sub) {
  return '╭─❖ ' + bold(String(title).toUpperCase()) + (sub ? '\n│ ' + small(sub) : '');
}
/** A titled break inside a card. */
function section(title) {
  return '├─ ' + bold(title);
}
const row = (k, v) => '◈ ' + small(k) + '  ›  ' + v;
const item = (s) => '• ' + s;
const cmd = (p, name, d) => '❯ ' + mono(p + name) + (d ? '  ' + small(d) : '');
const note = (s) => '❖ ' + small(s);
const meter = (frac, n = 10) => { const f = Math.max(0, Math.min(1, frac)); const k = Math.round(f * n); return '▰'.repeat(k) + '▱'.repeat(n - k); };
const foot = (s) => small(s || 'claudo-md');

/**
 * One look for every reply: a left rail, no right edge (proportional fonts make right edges ragged).
 *   ╭─❖ TITLE
 *   │ sub line
 *   │ lines...
 *   ╰─ footer
 */
function card(title, lines, opts = {}) {
  const out = [header(title, opts.sub)];
  if (opts.sub) out.push('│');
  let prevBlank = false;
  for (const l of lines) {
    for (const t of String(l).split('\n')) {
      if (t.startsWith('├')) { out.push(t); prevBlank = false; continue; }
      if (t.trim() === '') { if (!prevBlank) out.push('│'); prevBlank = true; continue; }
      out.push('│ ' + t); prevBlank = false;
    }
  }
  while (out.length && out[out.length - 1] === '│') out.pop();
  out.push(opts.foot === false ? '╰' + '─'.repeat(10) : '╰─ ' + foot(opts.foot));
  return out.join('\n');
}

module.exports = { bold, mono, script, small, header, section, row, item, cmd, note, meter, foot, card, bar };
