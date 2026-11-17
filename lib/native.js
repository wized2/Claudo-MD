/**
 * Native WhatsApp interactive messages: quick-reply buttons, URL/copy buttons, single-select lists.
 * Falls back to plain text when native send fails or UI mode is "text".
 */
const settings = require('./settings');
const ui = require('./ui');

function baileys() {
  return require('baileys');
}

function flowButton(b) {
  if (b.url) return { name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: String(b.text), url: b.url, merchant_url: b.url }) };
  if (b.copy) return { name: 'cta_copy', buttonParamsJson: JSON.stringify({ display_text: String(b.text), copy_code: String(b.copy) }) };
  return { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: String(b.text), id: String(b.id) }) };
}

/** Safe quoted key for generateWAMessageFromContent (avoids fromMe crash). */
function safeQuoted(m) {
  if (!m || !m.key || !m.key.remoteJid || !m.key.id) return undefined;
  const key = {
    remoteJid: m.key.remoteJid,
    id: m.key.id,
    fromMe: !!m.key.fromMe,
    participant: m.key.participant || undefined,
  };
  return { key, message: m.message };
}

async function relayInteractive(sock, jid, { title, body, footer, buttons }, quoted) {
  const { generateWAMessageFromContent, proto } = baileys();
  const IF = proto.Message.InteractiveMessage;
  const q = safeQuoted(quoted);
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
    q ? { quoted: q } : {}
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

/** Native interactive messages are opt-in: .ui native */
const enabled = () => settings.get('native') === true;

function textFallback({ title, body, footer, buttons, sections }, p) {
  // Prefer the bot card body as-is (already formatted with ui.card)
  const rows = sections ? sections.flatMap((s) => s.rows) : buttons || [];
  const opts = rows.map((r) => {
    if (r.url) return ui.item((r.text || r.title) + '  ›  ' + r.url);
    if (r.copy) return ui.item((r.text || r.title) + '  ›  ' + r.copy);
    const id = String(r.id || '').trim();
    const label = r.text || r.title || id;
    const cmd = id || label;
    return ui.item(cmd + (label && id && label !== id ? '  —  ' + label : ''));
  });
  if (body && String(body).includes('╭')) {
    // body is already a ui.card — append tappable ids as plain lines if any
    if (!opts.length) return String(body);
    return String(body) + '\n\n' + opts.join('\n');
  }
  const lines = [];
  if (title) lines.push(ui.small(title));
  if (body) lines.push(String(body));
  lines.push(...opts);
  return ui.card(title || 'Menu', lines.filter(Boolean), { foot: footer || false });
}

async function buttons(ctx, spec) {
  const list = (spec.buttons || []).slice(0, 3);
  if (!list.length || !enabled()) {
    await ctx.reply(textFallback(spec, ctx.prefix));
    return 'text';
  }
  try {
    await relayInteractive(
      ctx.sock,
      ctx.jid,
      {
        title: spec.title,
        body: spec.body,
        footer: spec.footer,
        buttons: list.map(flowButton),
      },
      ctx.m
    );
    return 'native';
  } catch (e) {
    console.warn('[native] buttons fallback:', e.message || e);
  }
  await ctx.reply(textFallback({ ...spec, buttons: list }, ctx.prefix));
  return 'text';
}

async function list(ctx, spec) {
  const sections = (spec.sections || [])
    .map((s) => ({
      title: String(s.title || 'Menu').slice(0, 24),
      rows: (s.rows || []).slice(0, 10).map((r) => ({
        title: String(r.title || r.id || '?').slice(0, 24),
        description: String(r.description || '').slice(0, 72),
        id: String(r.id || ''),
      })),
    }))
    .filter((s) => s.rows.length);
  if (!sections.length || !enabled()) {
    await ctx.reply(textFallback({ ...spec, sections }, ctx.prefix));
    return 'text';
  }
  try {
    const params = {
      title: String(spec.button || 'Open').slice(0, 20),
      sections: sections.map((s) => ({
        title: s.title,
        rows: s.rows.map((r) => ({
          header: '',
          title: r.title,
          description: r.description,
          id: r.id,
        })),
      })),
    };
    await relayInteractive(
      ctx.sock,
      ctx.jid,
      {
        title: spec.title,
        body: spec.body,
        footer: spec.footer,
        buttons: [{ name: 'single_select', buttonParamsJson: JSON.stringify(params) }],
      },
      ctx.m
    );
    return 'native';
  } catch (e) {
    console.warn('[native] list fallback:', e.message || e);
  }
  await ctx.reply(textFallback({ ...spec, sections }, ctx.prefix));
  return 'text';
}

module.exports = { buttons, list, textFallback, safeQuoted, enabled };
