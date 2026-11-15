const ui = require('./ui');
const { isOwner } = require('./owner');

const bare = (j) => String(j || '').split(':')[0].split('@')[0];

/** Loads metadata and checks admin rights. Returns { meta, senderAdmin, botAdmin } or null after replying. */
async function guard(ctx, { needBot = true, needSender = true } = {}) {
  const meta = await ctx.sock.groupMetadata(ctx.jid);
  const admins = meta.participants.filter((x) => x.admin).map((x) => bare(x.phoneNumber || x.id));
  const adminIds = meta.participants.filter((x) => x.admin).flatMap((x) => [bare(x.id), bare(x.phoneNumber)]);
  const me = [bare(ctx.sock.user && ctx.sock.user.id), bare(ctx.sock.user && ctx.sock.user.lid)];
  const sender = bare(ctx.sender);
  const botAdmin = me.some((x) => x && adminIds.includes(x));
  const senderAdmin = adminIds.includes(sender) || isOwner(ctx);
  if (needSender && !senderAdmin) { await ctx.reply(ui.small('admins only')); return null; }
  if (needBot && !botAdmin) { await ctx.reply(ui.small('make the bot an admin first')); return null; }
  return { meta, botAdmin, senderAdmin, admins };
}
module.exports = { guard, bare };
