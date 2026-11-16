/** Owner-controlled runtime features: private mode, auto read, typing, anti call, anti delete. */
const settings = require('./settings');
const msgStore = require('./msgStore');

const FLAGS = {
  autoread: ['Auto read', 'Mark incoming messages as read'],
  typing: ['Typing status', 'Show typing while a command runs'],
  anticall: ['Anti call', 'Reject calls with a short note'],
  antidelete: ['Anti delete', 'Send you messages that get deleted'],
};
const on = (k) => !!settings.get(k);
const isPrivate = () => settings.get('mode') === 'private';
const ownerJid = (config) => String(config.ownerNumber || '').replace(/\D/g, '') + '@s.whatsapp.net';

async function onRevoke(sock, m, config, store = msgStore) {
  if (!on('antidelete')) return false;
  const pm = m && m.message && m.message.protocolMessage;
  if (!pm || pm.type !== 0 || !pm.key || pm.key.fromMe) return false;
  const orig = await store.getMessage(pm.key);
  if (!orig) return false;
  const who = String(pm.key.participant || pm.key.participantPn || pm.key.remoteJid || '').split('@')[0].split(':')[0];
  const where = String(pm.key.remoteJid || '').endsWith('@g.us') ? ' in group ' + String(pm.key.remoteJid).split('@')[0] : '';
  const to = ownerJid(config);
  try {
    await sock.sendMessage(to, { text: 'Deleted message from ' + who + where + ':' });
    await sock.sendMessage(to, { forward: { key: pm.key, message: orig } });
  } catch (e) {
    console.warn('[antidelete]', e.message || e);
    return false;
  }
  return true;
}

async function onCall(sock, calls) {
  if (!on('anticall')) return 0;
  let n = 0;
  for (const c of calls || []) {
    if (c.status !== 'offer' || !c.id || !c.from) continue;
    try {
      await sock.rejectCall(c.id, c.from);
      await sock.sendMessage(c.from, { text: 'Calls are not accepted. Please send a message instead.' });
      n++;
    } catch (e) { console.warn('[anticall]', e.message || e); }
  }
  return n;
}

module.exports = { FLAGS, on, isPrivate, onRevoke, onCall, ownerJid };
