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

const W = 26;
const bar = '━'.repeat(W);

/** Boxed header. */
function header(title, sub) {
  return '┏' + bar + '┓\n┃  ' + bold(String(title).toUpperCase()) + '\n' + (sub ? '┃  ' + small(sub) + '\n' : '') + '┗' + bar + '┛';
}
function section(title) {
  return '\n◆ ' + bold(title) + '\n' + '─'.repeat(W);
}
const row = (k, v) => '▸ ' + small(k) + ' : ' + v;
const item = (s) => '◦ ' + s;
const cmd = (p, name, d) => '▸ ' + mono(p + name) + (d ? '  ' + small(d) : '');
const meter = (frac, n = 10) => { const f = Math.max(0, Math.min(1, frac)); const k = Math.round(f * n); return '▰'.repeat(k) + '▱'.repeat(n - k); };
const foot = (s) => '\n' + small(s || 'claudo-md');

function card(title, lines, opts = {}) {
  return [header(title, opts.sub), '', ...lines, opts.foot === false ? '' : foot(opts.foot)].join('\n').trim();
}

module.exports = { bold, mono, script, small, header, section, row, item, cmd, meter, foot, card, bar };
