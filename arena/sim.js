// 전투장 시뮬레이션: 유닛·공격·스킬·위협표·적 AI·기록. 헌터가 무엇을 할지는 ai.js 가 정한다.
// 같은 seed 면 같은 판이 나온다 (G.rng 만 쓴다).

const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const unitv = (x, y) => { const l = hyp(x, y) || 1; return { x: x / l, y: y / l }; };
const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
const faceOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 2 : 0));   // LPC 줄: 위0 왼1 아래2 오른3
const alive = u => u.state !== 'down' && u.state !== 'dead';
const liveHeroes = G => G.units.filter(u => u.team === 'h' && alive(u));
const liveFoes = G => G.units.filter(u => u.team === 'e' && alive(u));
const nearest = (p, list, f) => { let b = null, bd = 1e9; for (const u of list) { if (f && !f(u)) continue; const d = dist(u, p); if (d < bd) { bd = d; b = u; } } return b; };
const centroid = list => ({ x: list.reduce((a, u) => a + u.x, 0) / list.length, y: list.reduce((a, u) => a + u.y, 0) / list.length });
const inArena = p => ({ x: clamp(p.x, 0.6, ARENA.w - 0.6), y: clamp(p.y, 0.6, ARENA.h - 0.6) });
const STEP = 1 / 30;

function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function mergeStyle(id) {
  const s = STYLES[id] || STYLES.balance;
  return {
    id, n: s.n,
    w: { target: { ...BASE_W.target, ...(s.w.target || {}) }, heal: { ...BASE_W.heal, ...(s.w.heal || {}) }, kite: s.w.kite || BASE_W.kite },
    board: { ...BASE_BOARD, ...s.board }, priority: s.priority || {},
  };
}

function newBattle(scn, styleId, seed) {
  const rng = rngOf(seed);
  const G = { t: 0, rng, seed, scn, style: mergeStyle(styleId), units: [], shots: [], fx: [], warns: [], log: [], phase: 'play',
    stats: { dmgTaken: {}, healDone: 0, overheal: 0, dmgDone: 0, overkill: 0, slamIn: 0, slamHit: 0, switches: 0, flips: 0, tankT: 0, meleeT: 0, deaths: 0, end: 0 } };
  let id = 0;
  const cnt = {};
  const mk = (kind, team, x, y) => {
    const d = UNITS[kind];
    cnt[kind] = (cnt[kind] || 0) + 1;
    const u = { id: id++, kind, d, team, x, y, hp: d.hp, max: d.hp, mana: d.mana || 0, state: 'idle', atkCd: rng() * 0.5, atkT: 0, face: team === 'h' ? 3 : 1,
      animT: rng() * 2, moving: false, walkT: 0, cd: {}, threat: new Map(), target: null, why: '', pickT: 0, forcedT: 0, blockT: 0,
      thinkT: rng() * 0.2, plan: null, thought: null, say: '', sayT: 0, lastDir: null, lastDirT: -9, tgt: null, tgtSince: 0, spot: null, expAdj: {} };
    u.label = team === 'h' || SCENARIOS[scn].units.filter(k => k === kind).length < 2 ? d.name : d.name + cnt[kind];
    if (team === 'h') G.stats.dmgTaken[kind] = 0;
    G.units.push(u); return u;
  };
  PARTY.forEach((k, i) => { const p = PARTY_SPOTS[i]; mk(k, 'h', p[0] + (rng() - 0.5) * 1.5, p[1] + (rng() - 0.5) * 1.5); });
  const list = SCENARIOS[scn].units;
  list.forEach((k, i) => {
    const big = UNITS[k].scale;
    const y = big ? 8 : 2.5 + (i + 0.5) / list.length * 11;
    mk(k, 'e', (big ? 20 : 19.5 + rng() * 3) + (rng() - 0.5), y + (rng() - 0.5) * 1.5);
  });
  G.board = makeBoard(G);
  return G;
}

// ---------- 한 칸 진행 ----------
function step(G, dt) {
  if (G.phase !== 'play') return;
  G.t += dt;
  if (!liveFoes(G).length) return endBattle(G, 'won');
  if (!liveHeroes(G).length) return endBattle(G, 'lost');
  if (G.t >= TIME_LIMIT) return endBattle(G, 'timeout');
  updateBoard(G, dt);
  for (const u of G.units) {
    u.animT += dt; u.walkT = Math.max(0, u.walkT - dt); u.sayT -= dt;
    if (!alive(u)) { u.deadT = (u.deadT || 0) + dt; continue; }
    u.atkCd -= dt; u.blockT -= dt; u.forcedT -= dt;
    for (const k in u.cd) u.cd[k] -= dt;
    if (u.d.mana) u.mana = Math.min(u.d.mana, u.mana + u.d.manaRegen * dt);
    if (u.state === 'attack') { attackTick(G, u, dt); continue; }
    if (u.state === 'cast') { castTick(G, u, dt); continue; }
    if (u.state === 'slam') continue;
    if (u.team === 'h') heroTick(G, u, dt); else enemyTick(G, u, dt);
  }
  separate(G);
  shotsStep(G, dt);
  warnsStep(G, dt);
  for (const e of liveFoes(G)) if (e.d.melee && e.target) { G.stats.meleeT += dt; if (e.target.d.role === 'tank') G.stats.tankT += dt; }
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < (f.life || 1));
}
function endBattle(G, r) { G.phase = r; G.stats.end = G.t; }

// ---------- 헌터 행동 실행 (무엇을 할지는 think 가 정해 u.plan 에 둔다) ----------
function heroTick(G, u, dt) {
  u.thinkT -= dt;
  const p = u.plan;
  const stale = !p || (p.target && !alive(p.target)) || (p.kind === 'skill' && !skillReady(u, p.skill));
  if (u.thinkT <= 0 || stale) { think(G, u); u.thinkT = THINK_EVERY[0] + G.rng() * (THINK_EVERY[1] - THINK_EVERY[0]); }
  execute(G, u, dt);
}
function execute(G, u, dt) {
  const p = u.plan;
  if (!p) return;
  if (p.kind === 'move') { moveTo(G, u, p.spot, dt, 0.1); return; }
  const t = p.target;
  if (p.kind === 'skill') {
    const s = SKILLS[p.skill];
    if (s.range && t && t !== u && dist(u, t) > s.range) { moveTo(G, u, t, dt, s.range * 0.9); return; }
    if (p.reach && t && dist(u, t) > p.reach) { moveTo(G, u, t, dt, p.reach * 0.8); return; }
    startCast(G, u, p.skill, t);
    return;
  }
  if (p.kind === 'attack') {
    if (!t || !alive(t)) return;
    const d = dist(u, t);
    if (d <= u.d.range + 0.2) {
      if (u.atkCd <= 0) startAttack(G, u, t);
      else u.face = faceOf(t.x - u.x, t.y - u.y);
      return;
    }
    moveTo(G, u, t, dt, u.d.melee ? u.d.range * 0.85 : u.d.range - 0.5);
  }
}
const skillReady = (u, k) => (u.cd[k] || 0) <= 0 && (!SKILLS[k].mana || u.mana >= SKILLS[k].mana);

// ---------- 적 ----------
function enemyTick(G, u, dt) {
  const hs = liveHeroes(G);
  for (const h of hs) { const d = dist(u, h); if (d < 4) addThreat(u, h, (4 - d) * 1.5 * dt); }   // 가까운 헌터에게 조금씩 신경이 간다
  u.pickT -= dt;
  if (u.pickT <= 0 || !u.target || !alive(u.target)) { u.pickT = 0.3; pickTarget(G, u, hs); }
  const t = u.target;
  if (!t) return;
  // 오우거: 내려찍기 (바닥에 예고 원 → 1.5초 뒤 쾅)
  if (u.d.skills && u.d.skills.includes('slam') && (u.cd.slam || 0) <= 0 && dist(u, t) < SKILLS.slam.reach) {
    const s = SKILLS.slam;
    u.cd.slam = s.cd; u.state = 'slam'; u.animT = 0; u.face = faceOf(t.x - u.x, t.y - u.y);
    const w = { x: t.x, y: t.y, r: s.radius, T: 0, warn: s.warn, by: u, dmg: s.dmg, done: false, inside: [] };
    w.inside = liveHeroes(G).filter(h => dist(h, w) < w.r).map(h => h.id);
    G.stats.slamIn += w.inside.length;
    G.warns.push(w);
    return;
  }
  // 해골 궁수: 가까이 오면 먼저 도망 (벽에 몰리면 싸움)
  if (u.d.keepAway) {
    const c = nearest(u, hs);
    if (dist(u, c) < u.d.keepAway) {
      const away = unitv(u.x - c.x, u.y - c.y), goal = inArena({ x: u.x + away.x * 2, y: u.y + away.y * 2 });
      if (dist(goal, u) > 0.4) { moveTo(G, u, goal, dt, 0.05); return; }
    }
  }
  if (dist(u, t) <= u.d.range + 0.2) { if (u.atkCd <= 0) startAttack(G, u, t); return; }
  moveTo(G, u, t, dt, u.d.melee ? u.d.range * 0.85 : u.d.range - 0.5);
}
function addThreat(e, h, v) { e.threat.set(h.id, (e.threat.get(h.id) || 0) + v); }
function threatValue(e, h) { return (e.threat.get(h.id) || 0) * (e.d.backMul && (h.d.role === 'healer' || h.d.role === 'archer') ? e.d.backMul : 1); }
function pickTarget(G, u, hs) {
  if (u.forcedT > 0 && u.target && alive(u.target)) { u.why = `도발당함 (${u.forcedT.toFixed(1)}초 남음)`; return; }
  let best = null, bv = -1;
  for (const h of hs) { const v = threatValue(u, h); if (v > bv) { bv = v; best = h; } }
  if (bv <= 0) { best = nearest(u, hs); u.why = '가까워서'; }
  const cur = u.target && alive(u.target) ? u.target : null;
  if (cur && best !== cur) {
    const cv = threatValue(u, cur);
    if (bv < cv * 1.15) { u.why = `위협 최고는 ${best.d.name}지만 15% 차이 안 남 → ${cur.d.name} 유지`; return; }
  }
  if (bv > 0) u.why = u.d.backMul && best.d.role !== 'tank' && best.d.role !== 'dealer' ? `위협 최고 (뒷줄 ×${u.d.backMul})` : '위협 최고';
  u.target = best;
}

// ---------- 공격·스킬 ----------
function startAttack(G, u, t) {
  u.state = 'attack'; u.atkT = 0; u.atkTarget = t; u.hitDone = false; u.animT = 0;
  u.face = faceOf(t.x - u.x, t.y - u.y);
}
function attackTick(G, u, dt) {
  u.atkT += dt;
  const t = u.atkTarget;
  if (!u.hitDone && u.atkT >= u.d.atkTime * u.d.hitAt) {
    u.hitDone = true;
    if (t && alive(t)) {
      if (u.d.melee) { if (dist(u, t) <= u.d.range + 0.6) dealDamage(G, u, t, u.d.atk); }
      else G.shots.push({ x: u.x, y: u.y - 0.4, t, from: u, dmg: u.d.atk, kind: u.d.role === 'healer' ? 'bolt' : 'arrow' });
    }
  }
  if (u.atkT >= u.d.atkTime) { u.state = 'idle'; u.atkCd = u.d.melee ? 0.15 : 0.3; }
}
function startCast(G, u, k, t) {
  const s = SKILLS[k];
  if (!skillReady(u, k)) return;
  if (s.mana) u.mana -= s.mana;
  u.cd[k] = s.cd;
  if (t && t !== u) u.face = faceOf(t.x - u.x, t.y - u.y);
  if (s.amount) G.board.healClaims.set(t.id, { by: u.id, amt: s.amount, until: G.t + s.cast });
  if (!s.cast) { applySkill(G, u, k, t); return; }
  u.state = 'cast'; u.animT = 0; u.cast = { k, t, T: 0, done: false };
}
function castTick(G, u, dt) {
  const c = u.cast, s = SKILLS[c.k];
  c.T += dt;
  if (!c.done && c.T >= s.cast * (s.hitAt || 1)) { c.done = true; applySkill(G, u, c.k, c.t); }
  if (c.T >= s.cast) { u.state = 'idle'; u.cast = null; u.thinkT = 0; }
}
function applySkill(G, u, k, t) {
  const s = SKILLS[k];
  if (k === 'taunt') {
    const es = liveFoes(G).filter(e => dist(e, u) <= s.radius);
    for (const e of es) { let mx = 0; for (const v of e.threat.values()) mx = Math.max(mx, v); e.threat.set(u.id, mx * 1.1 + 1); e.target = u; e.forcedT = s.force; e.why = '도발당함'; }
    G.fx.push({ kind: 'ring', x: u.x, y: u.y, r: s.radius, color: '#f0b429', t: 0, life: 0.5 });
    G.fx.push({ kind: 'num', x: u.x, y: u.y - 1.6, text: `도발! ×${es.length}`, color: '#f0b429', t: 0, life: 1.1 });
  } else if (k === 'block') {
    u.blockT = s.dur;
    G.fx.push({ kind: 'num', x: u.x, y: u.y - 1.6, text: '방패!', color: '#9cc7ff', t: 0, life: 1 });
  } else if (k === 'whirl') {
    for (const e of liveFoes(G)) if (dist(e, u) <= s.radius) dealDamage(G, u, e, s.dmg);
    G.fx.push({ kind: 'ring', x: u.x, y: u.y, r: s.radius, color: '#ffffff', t: 0, life: 0.3 });
  } else if (k === 'aimed') {
    if (t && alive(t)) G.shots.push({ x: u.x, y: u.y - 0.4, t, from: u, dmg: u.d.atk * s.mult, kind: 'big' });
  } else if (s.amount) {
    if (t && alive(t)) heal(G, u, t, s.amount);
    G.board.healClaims.delete(t.id);
  }
}
function dealDamage(G, from, t, base) {
  if (!alive(t)) return;
  let dmg = base * (1 - t.d.armor) * (0.85 + G.rng() * 0.3);
  if (t.blockT > 0) dmg *= 1 - SKILLS.block.reduce;
  dmg = Math.max(1, Math.round(dmg));
  if (t.team === 'e') { G.stats.dmgDone += dmg; G.stats.overkill += Math.max(0, dmg - t.hp); addThreat(t, from, dmg * (from.d.role === 'tank' ? 4 : 1)); }
  else G.stats.dmgTaken[t.kind] += Math.min(dmg, t.hp);
  t.hp -= dmg;
  G.fx.push({ kind: 'num', x: t.x, y: t.y - 1.2, text: String(dmg), color: t.team === 'h' ? '#ff7a6b' : '#ffffff', t: 0, life: 0.9 });
  if (t.hp <= 0) {
    t.hp = 0; t.animT = 0;
    if (t.team === 'h') { t.state = 'down'; G.stats.deaths++; G.log.push({ t: G.t, id: t.id, name: t.d.name, text: '쓰러짐', why: '', bad: true }); }
    else t.state = 'dead';
  }
}
function heal(G, from, t, amount) {
  const eff = Math.min(amount, t.max - t.hp);
  t.hp += eff; G.stats.healDone += eff; G.stats.overheal += amount - eff;
  const es = liveFoes(G);
  for (const e of es) addThreat(e, from, eff * 0.5 / es.length);   // 힐도 적의 눈길을 끈다 (나눠서)
  G.fx.push({ kind: 'num', x: t.x, y: t.y - 1.2, text: '+' + Math.round(eff), color: '#7be37b', t: 0, life: 1 });
}
function shotsStep(G, dt) {
  for (const s of G.shots) {
    const dx = s.t.x - s.x, dy = s.t.y - 0.4 - s.y, d = hyp(dx, dy), v = 16 * dt;
    s.a = Math.atan2(dy, dx);
    if (d <= v || !alive(s.t)) { s.done = true; if (alive(s.t)) dealDamage(G, s.from, s.t, s.dmg); }
    else { s.x += dx / d * v; s.y += dy / d * v; }
  }
  G.shots = G.shots.filter(s => !s.done);
}
function warnsStep(G, dt) {
  for (const w of G.warns) {
    w.T += dt;
    if (!w.done && w.T >= w.warn) {
      w.done = true;
      for (const h of liveHeroes(G)) if (dist(h, w) < w.r) { dealDamage(G, w.by, h, w.dmg); if (w.inside.includes(h.id)) G.stats.slamHit++; }
      if (w.by.state === 'slam') { w.by.state = 'idle'; w.by.atkCd = 0.8; }
      G.fx.push({ kind: 'ring', x: w.x, y: w.y, r: w.r, color: '#ff5a3a', t: 0, life: 0.4 });
    }
  }
  G.warns = G.warns.filter(w => w.T < w.warn + 0.4);
  for (const e of liveFoes(G)) if (e.state === 'slam' && !G.warns.some(w => w.by === e && !w.done)) e.state = 'idle';
}

// ---------- 이동 ----------
function moveTo(G, u, goal, dt, stopAt) {
  u.moving = false;
  if (!goal) return;
  const g = inArena(goal), dx = g.x - u.x, dy = g.y - u.y, d = hyp(dx, dy);
  if (d <= stopAt) return;
  const v = Math.min(d - stopAt * 0.5, u.d.spd * dt);
  if (v <= 0.001) return;
  const nx = dx / d, ny = dy / d;
  // 걸음 떨림 기록: 0.4초 안에 반대로 돌아서면 한 번
  //   (같은 결정 안에서만 센다. 피하고 돌아오는 건 결정이 바뀐 것이라 떨림이 아님)
  const lbl = u.plan && u.plan.label;
  if (u.team === 'h' && u.lastDir && nx * u.lastDir.x + ny * u.lastDir.y < -0.5 && G.t - u.lastDirT < 0.4 && u.lastLbl === lbl) G.stats.flips++;
  u.lastDir = { x: nx, y: ny }; u.lastDirT = G.t; u.lastLbl = lbl;
  const p = inArena({ x: u.x + nx * v, y: u.y + ny * v });
  u.x = p.x; u.y = p.y;
  u.moving = true; u.walkT = 0.25; u.face = faceOf(dx, dy);
}
function separate(G) {
  const live = G.units.filter(alive);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j], dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
    const R = 0.62 * ((a.d.scale || 1) + (b.d.scale || 1)) / 2;
    if (d < R && d > 0.001) {
      const push = (R - d) * 0.25, px = dx / d * push, py = dy / d * push;
      const wa = a.d.scale ? 0.2 : 1, wb = b.d.scale ? 0.2 : 1;   // 큰 적은 잘 안 밀린다
      const pa = inArena({ x: a.x - px * wa, y: a.y - py * wa }), pb = inArena({ x: b.x + px * wb, y: b.y + py * wb });
      a.x = pa.x; a.y = pa.y; b.x = pb.x; b.y = pb.y;
    }
  }
}

// ---------- 결과 숫자 ----------
function summarize(G) {
  const S = G.stats, min = Math.max(S.end || G.t, 1) / 60;
  return {
    result: G.phase, time: S.end || G.t, deaths: S.deaths,
    tankPct: S.meleeT ? S.tankT / S.meleeT : 0,
    backDmg: (S.dmgTaken.archer || 0) + (S.dmgTaken.cleric || 0),
    slamDodge: S.slamIn ? 1 - S.slamHit / S.slamIn : null,
    switchPerMin: S.switches / min, overhealPct: S.healDone + S.overheal ? S.overheal / (S.healDone + S.overheal) : 0,
    overkillPct: S.dmgDone ? S.overkill / S.dmgDone : 0, flipPerMin: S.flips / min,
  };
}
function runOne(scn, style, seed) {
  const G = newBattle(scn, style, seed);
  while (G.phase === 'play') step(G, STEP);
  return summarize(G);
}
function aggregate(rows) {
  const n = rows.length, avg = f => rows.reduce((a, r) => a + f(r), 0) / n;
  const sd = rows.filter(r => r.slamDodge !== null);
  return {
    n, win: rows.filter(r => r.result === 'won').length / n, time: avg(r => r.time), deaths: avg(r => r.deaths), tankPct: avg(r => r.tankPct),
    backDmg: avg(r => r.backDmg), slamDodge: sd.length ? sd.reduce((a, r) => a + r.slamDodge, 0) / sd.length : null,
    switchPerMin: avg(r => r.switchPerMin), overhealPct: avg(r => r.overhealPct), overkillPct: avg(r => r.overkillPct), flipPerMin: avg(r => r.flipPerMin),
  };
}
