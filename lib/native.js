/**
 * Native WhatsApp interactive messages: quick-reply buttons, URL/copy buttons, single-select lists.
 * Every button/row id is a full command string (e.g. ".menu group"), so taps simply re-enter
 * the command router. Falls back to a plain text menu when native send fails or is disabled
 * (.ui text).
 */
const { generateWAMessageFromContent, proto } = require('baileys');
const settings = require('./settings');
const ui = require('./ui');

const IF = proto.Message.InteractiveMessage;

function flowButton(b) {
  if (b.url) return { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: String(b.text), url: b.url, merchant_url: b.url }) };
  if (b.copy) return { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: String(b.text), copy_code: String(b.copy) }) };
  return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: String(b.text), id: String(b.id) }) };
}

async function relayInteractive(sock, jid, { title, body, footer, buttons }, quoted) {
  const msg = generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: IF.create({
            header: title ? IF.Header.create({ title: String(title), hasMediaAttachment: false }) : undefined,
            body: IF.Body.create({ text: String(body || ' ') }),
            footer: footer ? IF.Footer.create({ text: String(footer) }) : undefined,
            nativeFlowMessage: IF.NativeFlowMessage.create({ buttons, messageParamsJson: '' }),
          }),
        },
      },
    },
    quoted ? { quoted } : {}
  );
  const biz = {
    tag: 'biz',
    attrs: {},
    content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }],
  };
  const extra = [biz];
  if (!String(jid).endsWith('@g.us')) extra.push({ tag: 'bot', attrs: { biz_bot: '1' } });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes: extra });
  return msg;
}

function textFallback({ title, body, footer, buttons, sections }, p) {
  const lines = [];
  if (title) lines.push(ui.header(title));
  if (body) lines.push('', body);
  const rows = sections ? sections.flatMap((s) => s.rows) : buttons || [];
  lines.push('');
  for (const r of rows) {
    if (r.url) lines.push('▸ ' + (r.text || r.title) + ' : ' + r.url);
    else if (r.copy) lines.push('▸ ' + (r.text || r.title) + ' : ' + r.copy);
    else lines.push('▸ ' + ui.mono(String(r.id || '').replace(/^\./, p || '.')) + '  ' + ui.small(r.text || r.title || ''));
  }
  if (footer) lines.push('', ui.small(footer));
  return lines.join('\n');
}

/** ctx: { sock, jid, m, reply, config }. spec: { title, body, footer, buttons:[{id,text}|{url,text}|{copy,text}] } */
async function buttons(ctx, spec) {
  const list = (spec.buttons || []).slice(0, 5);
  if (settings.get('native') !== false) {
    try {
      await relayInteractive(ctx.sock, ctx.jid, { ...spec, buttons: list.map(flowButton) }, ctx.m);
      return 'native';
    } catch (e) {
      console.warn('[native] buttons fallback:', e.message || e);
    }
  }
  await ctx.reply(textFallback({ ...spec, buttons: list }, ctx.config && ctx.config.prefix));
  return 'text';
}

/** spec: { title, body, footer, button: 'Open', sections:[{title, rows:[{id,title,description}]}] } */
async function list(ctx, spec) {
  const sections = (spec.sections || []).map((s) => ({
    title: String(s.title || ''),
    rows: (s.rows || []).slice(0, 10).map((r) => ({ header: r.header || '', title: String(r.title), description: String(r.description || ''), id: String(r.id) })),
  }));
  if (settings.get('native') !== false) {
    try {
      const params = { title: String(spec.button || 'Select'), sections };
      await relayInteractive(
        ctx.sock,
        ctx.jid,
        { title: spec.title, body: spec.body, footer: spec.footer, buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify(params) }] },
        ctx.m
      );
      return 'native';
    } catch (e) {
      console.warn('[native] list fallback:', e.message || e);
    }
  }
  await ctx.reply(textFallback({ ...spec, sections }, ctx.config && ctx.config.prefix));
  return 'text';
}

module.exports = { buttons, list, textFallback };
