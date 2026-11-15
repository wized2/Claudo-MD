/** Resolve a target user from mention, reply, or phone number argument. */
function ctxInfo(m) {
  const msg = m.message || {};
  for (const k of Object.keys(msg)) {
    const c = msg[k] && msg[k].contextInfo;
    if (c) return c;
  }
  return {};
}
const num = (s) => String(s || '').replace(/\D/g, '');

async function resolveTarget(ctx, { allowSelfDm = false } = {}) {
  const { sock, m, args } = ctx;
  const ci = ctxInfo(m);
  const typed = num(args.join(''));
  let jid = null;
  if (typed.length >= 7) {
    jid = typed + '@s.whatsapp.net';
    try {
      const r = await sock.onWhatsApp(jid);
      if (!r || !r[0] || !r[0].exists) return { error: 'That number is not on WhatsApp.' };
      jid = r[0].jid;
    } catch (_) {}
  } else if (ci.mentionedJid && ci.mentionedJid[0]) jid = ci.mentionedJid[0];
  else if (ci.participant) jid = ci.participant;
  else if (allowSelfDm && !ctx.group) jid = ctx.jid;
  if (!jid) return { error: null };
  return { jid, number: jid.split('@')[0].split(':')[0] };
}

module.exports = { resolveTarget, ctxInfo, num };
