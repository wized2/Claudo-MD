/** Tiny in-memory per-chat session store with TTL. */
const map = new Map();
const TTL = 30 * 60 * 1000;
function get(key) { const s = map.get(key); if (!s) return null; if (Date.now() - s.at > TTL) { map.delete(key); return null; } return s.v; }
function set(key, v) { map.set(key, { v, at: Date.now() }); return v; }
function del(key) { map.delete(key); }
function touch(key) { const s = map.get(key); if (s) s.at = Date.now(); }
module.exports = { get, set, del, touch };
