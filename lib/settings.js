const store = require('./jsonStore');
// Text-first: native buttons/lists are opt-in (.ui native) because rendering depends on the WhatsApp client.
const DEFAULTS = { native: false };
let cache = null;
function all() {
  if (!cache) cache = { ...DEFAULTS, ...(store.readJson('settings.json', {}) || {}) };
  return cache;
}
const get = (k) => all()[k];
function set(k, v) {
  all()[k] = v;
  store.writeJson('settings.json', cache);
}
module.exports = { get, set, all };
