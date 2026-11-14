const fs = require('fs');
const path = require('path');

function normalizePlugin(mod, file) {
  if (!mod || typeof mod.handler !== 'function') return null;
  return {
    ...mod,
    name: mod.name || file.replace(/\.js$/, ''),
    pattern: mod.pattern,
    aliases: mod.aliases || [],
    desc: mod.desc || '',
    category: mod.category || 'general',
    handler: mod.handler,
    file,
  };
}

function loadPlugins(dir) {
  const plugins = [];
  if (!fs.existsSync(dir)) return plugins;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    try {
      const full = path.join(dir, file);
      delete require.cache[require.resolve(full)];
      const mod = require(full);
      const list = Array.isArray(mod) ? mod : [mod];
      let loaded = 0;
      for (const item of list) {
        const p = normalizePlugin(item, file);
        if (!p) continue;
        plugins.push(p);
        loaded += 1;
      }
      if (!loaded) console.warn('[plugins] skip (no handler):', file);
      else console.log('[plugins] loaded', file, loaded > 1 ? `(${loaded})` : '');
    } catch (e) {
      console.error('[plugins] failed', file, e.message);
    }
  }
  return plugins;
}

function matchPlugin(plugins, text, prefix) {
  let raw = String(text || '').trim();
  if (!raw) return null;
  raw = raw.replace(/[‎‏‪-‮⁦-⁩]/g, '');
  if (raw.charAt(0) === '．') raw = '.' + raw.slice(1);
  const pfx = prefix || '.';
  if (!raw.startsWith(pfx)) return null;
  const body = raw.slice(pfx.length).trim();
  const [cmd, ...rest] = body.split(/\s+/);
  const arg = rest.join(' ').trim();
  const key = (cmd || '').toLowerCase();
  if (!key) return null;
  for (const p of plugins) {
    const names = [p.pattern, ...(p.aliases || [])]
      .filter(Boolean)
      .map((x) => String(x).toLowerCase());
    if (names.includes(key)) return { plugin: p, cmd: key, arg, args: rest, body };
  }
  return null;
}

function extractText(message) {
  if (!message) return '';
  let msg = message;
  for (let i = 0; i < 8; i++) {
    const inner =
      (msg.ephemeralMessage && msg.ephemeralMessage.message) ||
      (msg.viewOnceMessage && msg.viewOnceMessage.message) ||
      (msg.viewOnceMessageV2 && msg.viewOnceMessageV2.message) ||
      (msg.viewOnceMessageV2Extension && msg.viewOnceMessageV2Extension.message) ||
      (msg.documentWithCaptionMessage && msg.documentWithCaptionMessage.message);
    if (!inner) break;
    msg = inner;
  }
  // Native interactive / list / button replies: the id is a full command string
  const nativeParams =
    msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
    msg.interactiveResponseMessage?.native_flow_response_message?.paramsJson;
  if (nativeParams) {
    try {
      const p = JSON.parse(nativeParams);
      if (p.id) return String(p.id);
      if (p.selected_id) return String(p.selected_id);
      if (p.title) return String(p.title);
    } catch (_) {}
  }
  if (msg.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return String(msg.listResponseMessage.singleSelectReply.selectedRowId);
  }
  if (msg.buttonsResponseMessage?.selectedButtonId) return String(msg.buttonsResponseMessage.selectedButtonId);
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.buttonsResponseMessage?.selectedDisplayText ||
    msg.listResponseMessage?.title ||
    msg.templateButtonReplyMessage?.selectedDisplayText ||
    ''
  );
}

module.exports = { loadPlugins, matchPlugin, extractText };
