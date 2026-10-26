// 지도: 나무(지나가지도 보지도 못함)·덤불(지나갈 수 있지만 시야를 가림)·바위(못 지나감, 시야는 통함), 길 찾기, 시야(전장의 안개)

const T_GRASS = 0, T_TREE = 1, T_BUSH = 2, T_ROCK = 3;
const FOG_UNSEEN = 0, FOG_SEEN = 1, FOG_VISIBLE = 2;

function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function makeWorld(seed) {
  const R = mulberry(seed), W = MAP.w, H = MAP.h;
  const tiles = new Uint8Array(W * H), fog = new Uint8Array(W * H);
  // 나무 덩어리: 씨앗을 뿌리고 주변으로 번지게
  const blobs = Math.floor(W * H * MAP.treeDensity / 14);
  for (let b = 0; b < blobs; b++) {
    let x = Math.floor(R() * W), y = Math.floor(R() * H);
    const n = 6 + Math.floor(R() * 22);
    for (let i = 0; i < n; i++) {
      if (x >= 0 && y >= 0 && x < W && y < H) tiles[y * W + x] = R() < 0.82 ? T_TREE : T_BUSH;
      x += Math.floor(R() * 3) - 1; y += Math.floor(R() * 3) - 1;
    }
  }
  for (let i = 0; i < W * H * 0.012; i++) tiles[Math.floor(R() * W * H)] = T_BUSH;
  for (let i = 0; i < W * H * 0.006; i++) tiles[Math.floor(R() * W * H)] = T_ROCK;
  // 테두리는 숲
  for (let x = 0; x < W; x++) { tiles[x] = T_TREE; tiles[(H - 1) * W + x] = T_TREE; }
  for (let y = 0; y < H; y++) { tiles[y * W] = T_TREE; tiles[y * W + W - 1] = T_TREE; }
  const start = { x: 4, y: Math.floor(H / 2) };
  const clear = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) tiles[y * W + x] = T_GRASS; };
  clear(start.x, start.y, 3);
  const groupSpots = GROUPS.map(g => ({ x: Math.round(g.at[0] * W), y: Math.round(g.at[1] * H) }));
  groupSpots.forEach(p => clear(p.x, p.y, 3));
  // 모든 무리까지 길이 나도록 구불구불한 오솔길을 판다
  const carve = (a, b) => {
    let x = a.x, y = a.y;
    while (x !== b.x || y !== b.y) {
      clear(x, y, 1);
      if (R() < 0.6) x += Math.sign(b.x - x); else y += Math.sign(b.y - y);
      if (R() < 0.15) y += R() < 0.5 ? 1 : -1;
      x = Math.max(1, Math.min(W - 2, x)); y = Math.max(1, Math.min(H - 2, y));
    }
  };
  let prev = start;
  [...groupSpots].sort((a, b) => a.x - b.x).forEach(p => { carve(prev, p); prev = p; });
  carve(start, groupSpots[1]);
  const world = { W, H, tiles, fog, start, groupSpots, visibleList: [] };
  // 못 가는 섬은 나무로 메운다
  const reach = flood(world, start.x, start.y);
  for (let i = 0; i < W * H; i++) if (!reach[i] && tiles[i] !== T_TREE) tiles[i] = T_TREE;
  return world;
}

const walkable = (w, x, y) => x >= 0 && y >= 0 && x < w.W && y < w.H && (w.tiles[y * w.W + x] === T_GRASS || w.tiles[y * w.W + x] === T_BUSH);
const blocksSight = (w, x, y) => { const t = w.tiles[y * w.W + x]; return t === T_TREE || t === T_BUSH; };

function flood(w, sx, sy) {
  const seen = new Uint8Array(w.W * w.H), q = [[sx, sy]]; seen[sy * w.W + sx] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (walkable(w, nx, ny) && !seen[ny * w.W + nx]) { seen[ny * w.W + nx] = 1; q.push([nx, ny]); }
    }
  }
  return seen;
}

// A* (8방향, 대각선은 양옆이 막히면 못 감). 돌려주는 값 = 칸 중심 좌표 목록
const _g = new Float32Array(MAP.w * MAP.h), _came = new Int32Array(MAP.w * MAP.h), _stamp = new Uint32Array(MAP.w * MAP.h);
let _run = 0;
function findPath(w, sx, sy, tx, ty, maxNodes = 4000) {
  sx = Math.floor(sx); sy = Math.floor(sy); tx = Math.floor(tx); ty = Math.floor(ty);
  if (!walkable(w, tx, ty)) { const n = nearestWalkable(w, tx, ty); if (!n) return null; tx = n.x; ty = n.y; }
  if (sx === tx && sy === ty) return [{ x: tx + 0.5, y: ty + 0.5 }];
  const W = w.W, run = ++_run, s0 = sy * W + sx, goal = ty * W + tx;
  const heap = [];   // [f, 칸 번호] 작은 것이 위로
  const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const getG = k => (_stamp[k] === run ? _g[k] : 1e9);
  _stamp[s0] = run; _g[s0] = 0; _came[s0] = -1;
  push(Math.hypot(tx - sx, ty - sy), s0);
  let n = 0;
  while (heap.length && n++ < maxNodes) {
    const [f, k] = pop(), x = k % W, y = (k - x) / W, gk = _g[k];
    if (f > gk + Math.hypot(tx - x, ty - y) + 1e-4) continue;   // 이미 더 좋은 길로 처리된 칸
    if (k === goal) {
      const path = []; let c = k;
      while (c !== s0) { path.push({ x: (c % W) + 0.5, y: Math.floor(c / W) + 0.5 }); c = _came[c]; }
      return path.reverse();
    }
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (!walkable(w, nx, ny)) continue;
      if (dx && dy && (!walkable(w, x + dx, y) || !walkable(w, x, y + dy))) continue;
      const nk = ny * W + nx, ng = gk + (dx && dy ? 1.414 : 1);
      if (ng < getG(nk)) { _stamp[nk] = run; _g[nk] = ng; _came[nk] = k; push(ng + Math.hypot(tx - nx, ty - ny), nk); }
    }
  }
  return null;
}
function nearestWalkable(w, x, y) {
  for (let r = 1; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (walkable(w, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return null;
}
// 두 점 사이가 트였는지 (시야·활 쏘기)
function lineClear(w, x0, y0, x1, y1) {
  if (!Number.isFinite(x0 + y0 + x1 + y1)) return false;
  let x = Math.floor(x0), y = Math.floor(y0); const ex = Math.floor(x1), ey = Math.floor(y1);
  const dx = Math.abs(ex - x), dy = -Math.abs(ey - y), sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 500 && !(x === ex && y === ey); guard++) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (x === ex && y === ey) break;
    if (blocksSight(w, x, y)) return false;
  }
  return true;
}
// 헌터들 시야로 안개를 걷는다
function updateFog(w, eyes) {
  for (const i of w.visibleList) w.fog[i] = FOG_SEEN;
  w.visibleList = [];
  for (const e of eyes) {
    const r = e.d ? e.d.sight : e.sight, cx = e.x, cy = e.y;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
      const i = y * w.W + x;
      if (w.fog[i] === FOG_VISIBLE) continue;
      if (lineClear(w, cx, cy, x + 0.5, y + 0.5)) { w.fog[i] = FOG_VISIBLE; w.visibleList.push(i); }
    }
  }
}
const isVisible = (w, x, y) => w.fog[Math.floor(y) * w.W + Math.floor(x)] === FOG_VISIBLE;

// 알아서 탐험: 안 가 본 곳과 맞닿은, 가장 가까운 가 본 칸
function frontierTarget(w, x, y, dirx, diry) {
  let best = null, bs = 1e9;
  for (let ty = 1; ty < w.H - 1; ty += 1) for (let tx = 1; tx < w.W - 1; tx += 1) {
    const i = ty * w.W + tx;
    if (w.fog[i] === FOG_UNSEEN || !walkable(w, tx, ty)) continue;
    if (!(w.fog[i - 1] === FOG_UNSEEN || w.fog[i + 1] === FOG_UNSEEN || w.fog[i - w.W] === FOG_UNSEEN || w.fog[i + w.W] === FOG_UNSEEN)) continue;
    const dx = tx + 0.5 - x, dy = ty + 0.5 - y, d = Math.hypot(dx, dy);
    if (d < 3) continue;
    const s = d - ((dx * dirx + dy * diry) / (d || 1)) * 3;   // 가던 방향 쪽을 조금 더 좋아함
    if (s < bs) { bs = s; best = { x: tx + 0.5, y: ty + 0.5 }; }
  }
  return best;
}
