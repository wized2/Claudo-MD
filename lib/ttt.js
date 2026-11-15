/** Tic-tac-toe logic (pure). board: array(9) of 'X' | 'O' | null. */
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(b) { for (const [x, y, z] of LINES) if (b[x] && b[x] === b[y] && b[y] === b[z]) return b[x]; return null; }
const full = (b) => b.every(Boolean);
function minimax(b, me, turn) {
  const w = winner(b);
  if (w) return w === me ? 10 : -10;
  if (full(b)) return 0;
  const scores = [];
  b.forEach((c, i) => { if (!c) { b[i] = turn; scores.push(minimax(b, me, turn === 'X' ? 'O' : 'X')); b[i] = null; } });
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}
function bestMove(b, me) {
  const opp = me === 'X' ? 'O' : 'X';
  let best = -99, mv = -1;
  b.forEach((c, i) => { if (!c) { b[i] = me; const s = minimax(b, me, opp); b[i] = null; if (s > best) { best = s; mv = i; } } });
  return mv;
}
function render(b) {
  const g = (i) => (b[i] === 'X' ? '✕' : b[i] === 'O' ? '○' : String(i + 1));
  return [0, 3, 6].map((r) => '  ' + [0, 1, 2].map((c) => g(r + c)).join('  ┃  ')).join('\n  ━━━╋━━━━╋━━━\n').replace(/━━━╋━━━━╋━━━/g, '━━━━╋━━━━━╋━━━━');
}
module.exports = { winner, full, bestMove, render };
