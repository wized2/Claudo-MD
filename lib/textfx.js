/** Offline text helpers. */
const crypto = require('crypto');
const A = 'abcdefghijklmnopqrstuvwxyz', U = A.toUpperCase(), D = '0123456789';
const mk = (up, lo, dg) => { const m = {}; [...U].forEach((c, i) => { m[c] = [...up][i]; }); [...A].forEach((c, i) => { m[c] = [...lo][i]; }); if (dg) [...D].forEach((c, i) => { m[c] = [...dg][i]; }); return m; };
const STYLES = {
  bold: mk('𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭', '𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇', '𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵'),
  italic: mk('𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡', '𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻'),
  mono: mk('𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉', '𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣', '𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿'),
  serif: mk('𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙', '𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳', '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗'),
  bubble: mk('ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ', 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ', '⓪①②③④⑤⑥⑦⑧⑨'),
  wide: mk('ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ', 'ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ', '０１２３４５６７８９'),
  small: mk(U, 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ'),
};
const fancy = (t, style) => [...String(t)].map((c) => (STYLES[style][c] || c)).join('');
const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
const REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const toMorse = (t) => String(t).toLowerCase().split(/\s+/).map((w) => [...w].map((c) => MORSE[c]).filter(Boolean).join(' ')).filter(Boolean).join(' / ');
const fromMorse = (t) => String(t).trim().split(/\s*\/\s*/).map((w) => w.split(/\s+/).map((c) => REV[c] || '?').join('')).join(' ');
const isMorse = (t) => /^[.\-/\s]+$/.test(t);
const reverse = (t) => [...String(t)].reverse().join('');
const toBinary = (t) => [...Buffer.from(String(t), 'utf8')].map((b) => b.toString(2).padStart(8, '0')).join(' ');
const fromBinary = (t) => Buffer.from(String(t).trim().split(/\s+/).map((b) => parseInt(b, 2)).filter((n) => n >= 0 && n < 256)).toString('utf8');
const hash = (alg, t) => crypto.createHash(alg).update(String(t)).digest('hex');
module.exports = { STYLES, fancy, toMorse, fromMorse, isMorse, reverse, toBinary, fromBinary, hash };
