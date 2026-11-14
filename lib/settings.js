const store = require('./jsonStore');
const DEFAULTS = { native: true };
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
