// 탐험 + 전투 시뮬레이션. 평소엔 실시간, 큰 사건(적 발견·기습·합류·동료 위기) 때 pauseReq 를 띄운다.
// 헌터는 지금 올려 둔 작전 카드(G.card)대로 움직인다.

const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const unitv = (x, y) => { const l = hyp(x, y) || 1; return { x: x / l, y: y / l }; };
const faceOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 2 : 0));   // LPC 줄: 위0 왼1 아래2 오른3

function newGame(seed) {
  const world = makeWorld(seed || MAP.seed);
  const G = { world, t: 0, units: [], groups: [], card: 'defend', combat: false, phase: 'play', pauseReq: null, toasts: [], fx: [], shots: [],
    anchor: { x: world.start.x + 0.5, y: world.start.y + 0.5, mode: 'hold', dest: null, path: null, dir: { x: 1, y: 0 }, trail: [], speed: 0 },
    form: null, focusTarget: null, critSeen: new Set(), fogT: 0, stats: { kills: 0, start: 0 } };
  let id = 0;
  const mk = (kind, team, x, y, group) => {
    const d = UNITS[kind];
    const u = { id: id++, kind, d, team, x, y, vx: 0, vy: 0, hp: d.hp, max: d.hp, state: 'idle', atkCd: Math.random(), atkT: 0, target: null,
      path: null, pathT: 0, pathGoal: null, face: 2, animT: Math.random() * 2, moving: false, group, home: { x, y }, deadT: 0 };
    G.units.push(u); return u;
  };
  PARTY.forEach((k, i) => mk(k, 'h', world.start.x + 0.5 - i * 1.2, world.start.y + 0.5 + (i ? 1 : 0), null));
  GROUPS.forEach((g, gi) => {
    const s = world.groupSpots[gi];
    const grp = { id: gi, units: [], discovered: false, engaged: false, done: false };
    g.units.forEach((k, i) => {
      const a = i / g.units.length * Math.PI * 2;
      let x = s.x + 0.5 + Math.cos(a) * 1.4, y = s.y + 0.5 + Math.sin(a) * 1.4;
      if (!walkable(world, Math.floor(x), Math.floor(y))) { x = s.x + 0.5; y = s.y + 0.5; }
      grp.units.push(mk(k, 'e', x, y, grp));
    });
    G.groups.push(grp);
  });
  updateFog(world, heroes(G));
  return G;
}
const heroes = G => G.units.filter(u => u.team === 'h' && u.state !== 'down');
const allHeroes = G => G.units.filter(u => u.team === 'h');
const alive = u => u.state !== 'down' && u.state !== 'dead';
const foesOf = G => G.units.filter(u => u.team === 'e' && alive(u) && u.group.engaged);
const nearest = (p, list, f) => { let b = null, bd = 1e9; for (const u of list) { if (f && !f(u)) continue; const d = hyp(u.x - p.x, u.y - p.y); if (d < bd) { bd = d; b = u; } } return b; };
const centroid = list => ({ x: list.reduce((a, u) => a + u.x, 0) / list.length, y: list.reduce((a, u) => a + u.y, 0) / list.length });
const toast = (G, text, kind) => { G.toasts.push({ text, kind: kind || '', t: G.t }); if (G.toasts.length > 6) G.toasts.shift(); };

function describeGroup(grp) {
  const cnt = {};
  for (const u of grp.units) if (alive(u)) cnt[u.d.name] = (cnt[u.d.name] || 0) + 1;
  return Object.entries(cnt).map(([n, c]) => `${n} ${c}`).join(' · ');
}
function requestPause(G, kind, title, lines, grp) {
  if (G.pauseReq) { G.pauseReq.lines.push(...lines); return; }   // 같은 순간 사건은 한 번에
  G.pauseReq = { kind, title, lines, grp };
}

// ---------- 한 칸 진행 ----------
const STEP = 1 / 30;
function step(G, dt) {
  if (G.phase !== 'play') return;
  G.t += dt;
  const W = G.world;
  G.fogT -= dt;
  if (G.fogT <= 0) { G.fogT = 0.12; updateFog(W, heroes(G)); }

  // 적 발견 / 기습 / 합류
  for (const grp of G.groups) {
    if (grp.done) continue;
    const live = grp.units.filter(alive);
    if (!live.length) continue;
    if (!grp.discovered && live.some(u => isVisible(W, u.x, u.y))) {
      grp.discovered = true; grp.engaged = true;
      stopAnchor(G);
      requestPause(G, 'discover', '적 무리 발견!', [describeGroup(grp)], grp);
    }
    if (!grp.engaged) {
      // 적이 먼저 우리를 보면 기습
      const seer = live.find(e => heroes(G).some(h => hyp(h.x - e.x, h.y - e.y) < e.d.sight && lineClear(W, e.x, e.y, h.x, h.y)));
      if (seer) {
        grp.engaged = true; grp.discovered = true; stopAnchor(G);
        requestPause(G, 'ambush', '기습당했어요!', [`${describeGroup(grp)} 이(가) 먼저 우리를 봤어요`], grp);
      } else if (G.combat) {
        const fighters = [...foesOf(G), ...heroes(G)];
        if (live.some(e => fighters.some(f => hyp(f.x - e.x, f.y - e.y) < REINFORCE_RADIUS))) {
          grp.engaged = true; grp.discovered = true;
          requestPause(G, 'reinforce', '새 적 무리 합류!', [`싸움 소리를 듣고 ${describeGroup(grp)} 이(가) 달려와요`], grp);
        }
      }
    }
  }
  const wasCombat = G.combat;
  G.combat = foesOf(G).length > 0;
  if (G.combat && !wasCombat) { G.form = null; G.focusTarget = null; }
  if (!G.combat && wasCombat) endFight(G);

  if (!G.combat) moveAnchor(G, dt); else { const hs = heroes(G); if (hs.length) { const c = centroid(hs); G.anchor.x = c.x; G.anchor.y = c.y; } }

  for (const u of G.units) {
    u.animT += dt; u.walkT = Math.max(0, (u.walkT || 0) - dt);
    if (u.state === 'dead') { u.deadT += dt; continue; }
    if (u.state === 'down') continue;
    u.atkCd -= dt;
    if (u.state === 'attack') { attackTick(G, u, dt); continue; }
    const plan = u.team === 'h' ? (G.combat ? heroPlan(G, u) : explorePlan(G, u)) : enemyPlan(G, u);
    if (plan.target && tryAttack(G, u, plan.target)) continue;
    moveUnit(G, u, plan.moveTo, dt, plan.speedMul || 1);
  }
  separate(G);
  shotsStep(G, dt);
  for (const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < (f.life || 1));

  // 동료 위기
  for (const h of heroes(G)) {
    if (h.hp < h.max * CRITICAL_HP && !G.critSeen.has(h.id) && G.combat) {
      G.critSeen.add(h.id);
      if (PAUSE_ON.critical) requestPause(G, 'critical', '동료가 위험해요!', [`${h.d.name} 체력 ${Math.ceil(h.hp)} / ${h.max}`]);
      else toast(G, `⚠ ${h.d.name} 위험! (체력 ${Math.ceil(h.hp)})`, 'warn');
    }
  }
  if (!heroes(G).length) { G.phase = 'lost'; }
}

function stopAnchor(G) { const a = G.anchor; if (a.mode === 'move') { a.mode = 'hold'; a.dest = null; a.path = null; } }
function endFight(G) {
  const dead = G.groups.filter(g => g.engaged && !g.done && !g.units.some(alive));
  dead.forEach(g => { g.done = true; });
  for (const h of allHeroes(G)) {
    if (h.state === 'down') { h.state = 'idle'; h.hp = Math.round(h.max * 0.3); toast(G, `${h.d.name} 다시 일어났어요 (체력 30%)`); }
    else h.hp = Math.min(h.max, h.hp + h.max * 0.4);   // 싸움이 끝나면 숨을 고르며 회복
  }
  G.critSeen.clear();
  const left = G.groups.filter(g => !g.done).length;
  toast(G, left ? `전투 승리! 남은 적 무리 ${left}` : '모든 적 무리를 물리쳤어요!', 'good');
  if (!left) G.phase = 'won';
}

// ---------- 탐험: 기준점(anchor)이 길을 가고, 헌터는 카드 대형대로 따라간다 ----------
function moveAnchor(G, dt) {
  const a = G.anchor, W = G.world;
  if (a.mode === 'auto' && (!a.path || !a.path.length)) {
    const tgt = frontierTarget(W, a.x, a.y, a.dir.x, a.dir.y);
    if (!tgt) { a.mode = 'hold'; toast(G, '더 탐험할 곳이 없어요'); return; }
    a.dest = tgt; a.path = findPath(W, a.x, a.y, tgt.x, tgt.y);
    if (!a.path) { a.mode = 'hold'; return; }
  }
  if (a.mode === 'hold' || !a.path || !a.path.length) { a.speed = 0; if (a.mode === 'move') a.mode = 'hold'; return; }
  // 헌터가 너무 뒤처지면 기다린다
  const hs = heroes(G);
  // 헌터가 뒤처지면 기다리지 말고 천천히 (뚝뚝 끊기지 않게)
  const lag = Math.max(...hs.map(h => hyp(h.x - a.x, h.y - a.y)));
  a.speed = 2.6 * clamp(1 - (lag - 2.5) / 3, 0.25, 1);
  const n = a.path[0], dx = n.x - a.x, dy = n.y - a.y, d = hyp(dx, dy), v = a.speed * dt;
  const tl = a.trail[a.trail.length - 1];
  if (!tl || hyp(tl.x - a.x, tl.y - a.y) > 0.15) { a.trail.push({ x: a.x, y: a.y }); if (a.trail.length > 120) a.trail.shift(); }
  if (d <= v) { a.x = n.x; a.y = n.y; a.path.shift(); if (!a.path.length && a.mode === 'move') a.mode = 'hold'; }
  else { a.x += dx / d * v; a.y += dy / d * v; a.dir.x += (dx / d - a.dir.x) * 0.1; a.dir.y += (dy / d - a.dir.y) * 0.1; }
}
// 탐험할 때 카드마다 대형 [앞으로, 옆으로]
const MARCH = {
  defend: { knight: [1.4, 0], archer: [-1.6, 0] },
  spread: { knight: [0.8, -2.4], archer: [-0.8, 2.4] },
  focus: { knight: [0.5, -0.6], archer: [-0.5, 0.6] },
  man: { knight: [0, -1.4], archer: [0, 1.4] },
  retreat: { knight: [-0.4, 0], archer: [1.0, 0] },
};
function alongPath(a, d) {   // 기준점에서 앞으로 갈 길을 따라 d칸 간 지점
  let px = a.x, py = a.y, left = d;
  for (const n of a.path || []) {
    const seg = hyp(n.x - px, n.y - py);
    if (seg >= left) return { x: px + (n.x - px) / seg * left, y: py + (n.y - py) / seg * left };
    left -= seg; px = n.x; py = n.y;
  }
  return { x: px, y: py };
}
function alongTrail(a, d) {   // 지나온 자취를 따라 d칸 뒤 지점
  let px = a.x, py = a.y, left = d;
  for (let i = a.trail.length - 1; i >= 0; i--) {
    const n = a.trail[i], seg = hyp(n.x - px, n.y - py);
    if (seg >= left) return { x: px + (n.x - px) / seg * left, y: py + (n.y - py) / seg * left };
    left -= seg; px = n.x; py = n.y;
  }
  return { x: px, y: py };
}
function explorePlan(G, u) {
  const a = G.anchor, f = (MARCH[G.card] || MARCH.defend)[u.kind] || [0, 0], W = G.world;
  const base = f[0] >= 0 ? alongPath(a, f[0]) : alongTrail(a, -f[0]);
  const dir = unitv(a.dir.x, a.dir.y), side = { x: -dir.y, y: dir.x };
  let p = { x: base.x + side.x * f[1], y: base.y + side.y * f[1] };
  if (!walkable(W, Math.floor(p.x), Math.floor(p.y)) || !lineClear(W, base.x, base.y, p.x, p.y)) p = base;   // 좁은 길이면 옆으로 안 벌림
  p.follow = a.speed;
  return { moveTo: p };
}

// ---------- 전투: 카드별 헌터 행동 ----------
function heroPlan(G, u) {
  const foes = foesOf(G);
  const K = G.units.find(h => h.kind === 'knight' && alive(h)), A = G.units.find(h => h.kind === 'archer' && alive(h));
  const seen = foes.filter(e => isVisible(G.world, e.x, e.y) || hyp(e.x - u.x, e.y - u.y) < 3);
  const pool = seen.length ? seen : foes;
  const C = centroid(pool), party = centroid(heroes(G));
  const inRange = (t, r) => t && hyp(t.x - u.x, t.y - u.y) <= r;
  const kite = (minD, keepR, tgt) => {
    const close = nearest(u, foes);
    if (close && hyp(close.x - u.x, close.y - u.y) < minD) { const away = unitv(u.x - close.x, u.y - close.y); return { x: u.x + away.x * 3, y: u.y + away.y * 3 }; }
    if (tgt && hyp(tgt.x - u.x, tgt.y - u.y) > keepR) return { x: tgt.x, y: tgt.y };
    return null;
  };
  switch (G.card) {
    case 'defend': {
      // 대형 기준점이 적 쪽으로 천천히 전진, 기사는 그 앞, 궁수는 그 뒤
      if (!G.form) G.form = { x: party.x, y: party.y };
      const toC = unitv(C.x - G.form.x, C.y - G.form.y), dC = hyp(C.x - G.form.x, C.y - G.form.y);
      const FORM_SPD = 1.2, advancing = dC > 5;
      if (u === heroes(G)[0] && advancing) { G.form.x += toC.x * FORM_SPD * STEP; G.form.y += toC.y * FORM_SPD * STEP; }   // 한 틱에 한 번만 전진
      const follow = advancing ? FORM_SPD : 0;   // 기준점 속도에 맞춰 같이 걷기
      const onlyRanged = !foes.some(e => e.d.melee);   // 원거리 적만 남으면 버티지 말고 잡으러 간다
      if (u.kind === 'knight') {
        const threat = A ? nearest(A, foes) : nearest(u, foes);
        if (threat && A && hyp(threat.x - A.x, threat.y - A.y) < 4.5) return { target: threat, moveTo: threat };
        const t = nearest(u, foes);
        if (onlyRanged && t) return { target: t, moveTo: t };
        return { target: inRange(t, u.d.range + 0.3) ? t : null, moveTo: { x: G.form.x + toC.x * 1.3, y: G.form.y + toC.y * 1.3, follow } };
      }
      const t = (K && K.target && alive(K.target) && inRange(K.target, u.d.range)) ? K.target : nearest(u, pool);
      if (onlyRanged && t) return { target: t, moveTo: kite(2.6, u.d.range - 0.5, t) };
      return { target: t, moveTo: { x: G.form.x - toC.x * 1.6, y: G.form.y - toC.y * 1.6, follow } };
    }
    case 'spread': {
      const t = nearest(u, pool);
      if (u.kind === 'knight') return { target: t, moveTo: t };
      return { target: t, moveTo: kite(3.5, u.d.range - 0.5, t) };
    }
    case 'focus': {
      if (!G.focusTarget || !alive(G.focusTarget)) G.focusTarget = nearest(party, pool);
      const t = G.focusTarget;
      if (!t) return {};
      if (u.kind === 'knight') return { target: t, moveTo: t };
      return { target: t, moveTo: hyp(t.x - u.x, t.y - u.y) > 5 ? t : null };
    }
    case 'man': {
      if (u.kind === 'knight') {
        const onArcher = A && foes.find(e => e.target === A && hyp(e.x - A.x, e.y - A.y) < 2.6);   // 커버
        const t = onArcher || nearest(u, foes, e => e.d.melee) || nearest(u, foes);
        u.target = t;
        return { target: t, moveTo: t };
      }
      const t = nearest(u, pool, e => !e.d.melee) || nearest(u, pool, e => !K || e !== K.target) || nearest(u, pool);
      return { target: t, moveTo: kite(2.6, u.d.range - 0.5, t) };
    }
    case 'retreat': {
      const away = unitv(party.x - C.x, party.y - C.y);
      const R = { x: party.x + away.x * 4, y: party.y + away.y * 4 };
      const t = nearest(u, pool);
      if (u.kind === 'knight') return { target: inRange(t, u.d.range + 0.2) ? t : null, moveTo: { x: R.x - away.x * 0.6, y: R.y - away.y * 0.6 }, speedMul: 0.85 };
      return { target: t, moveTo: { x: R.x + away.x * 1.5, y: R.y + away.y * 1.5 }, speedMul: 0.85 };
    }
  }
  return {};
}

// ---------- 적 ----------
function enemyPlan(G, u) {
  if (!u.group.engaged) {
    if (hyp(u.home.x - u.x, u.home.y - u.y) > 1.5) return { moveTo: u.home, speedMul: 0.5 };
    return {};
  }
  const hs = heroes(G);
  if (!hs.length) return {};
  let t = u.d.hunts === 'weak' ? hs.slice().sort((a, b) => a.max - b.max)[0] : nearest(u, hs);
  if (u.target && alive(u.target) && hyp(u.target.x - u.x, u.target.y - u.y) < hyp(t.x - u.x, t.y - u.y) + 1.5) t = u.target;
  u.target = t;
  if (u.d.keepAway) {
    const close = nearest(u, hs), dc = hyp(close.x - u.x, close.y - u.y);
    if (dc < u.d.keepAway) { const away = unitv(u.x - close.x, u.y - close.y); return { target: t, moveTo: { x: u.x + away.x * 2, y: u.y + away.y * 2 } }; }
    return { target: t, moveTo: hyp(t.x - u.x, t.y - u.y) > u.d.range - 0.5 ? t : null };
  }
  return { target: t, moveTo: t };
}

// ---------- 공격 ----------
function tryAttack(G, u, t) {
  if (!t || !alive(t) || u.atkCd > 0) return false;
  const d = hyp(t.x - u.x, t.y - u.y);
  if (d > u.d.range + 0.2) return false;
  if (!u.d.melee && !lineClear(G.world, u.x, u.y, t.x, t.y)) return false;
  u.state = 'attack'; u.atkT = 0; u.atkTarget = t; u.hitDone = false; u.animT = 0;
  u.face = faceOf(t.x - u.x, t.y - u.y);
  return true;
}
function attackTick(G, u, dt) {
  u.atkT += dt;
  const t = u.atkTarget;
  if (!u.hitDone && u.atkT >= u.d.atkTime * u.d.hitAt) {
    u.hitDone = true;
    if (t && alive(t)) {
      if (u.d.melee) { if (hyp(t.x - u.x, t.y - u.y) <= u.d.range + 0.6) hit(G, u, t, u.d.atk); }
      else G.shots.push({ x: u.x, y: u.y - 0.4, t, from: u, dmg: u.d.atk });
    }
  }
  if (u.atkT >= u.d.atkTime) { u.state = 'idle'; u.atkCd = u.d.melee ? 0.15 : 0.3; }
}
function hit(G, from, t, base) {
  if (!alive(t)) return;
  const dmg = Math.max(1, Math.round(base * (1 - t.d.armor) * (0.85 + Math.random() * 0.3)));
  t.hp -= dmg;
  G.fx.push({ kind: 'num', x: t.x, y: t.y - 1.2, text: String(dmg), color: t.team === 'h' ? '#ff7a6b' : '#ffffff', t: 0, life: 0.9 });
  if (t.team === 'e' && !t.group.engaged) { t.group.engaged = true; t.group.discovered = true; }
  if (t.hp <= 0) {
    t.hp = 0;
    if (t.team === 'h') { t.state = 'down'; t.animT = 0; toast(G, `${t.d.name} 쓰러졌어요!`, 'bad'); }
    else { t.state = 'dead'; t.animT = 0; G.stats.kills++; }
  }
}
function shotsStep(G, dt) {
  for (const s of G.shots) {
    const dx = s.t.x - s.x, dy = s.t.y - 0.4 - s.y, d = hyp(dx, dy), v = 16 * dt;
    s.a = Math.atan2(dy, dx);
    if (d <= v || !alive(s.t)) { s.done = true; if (alive(s.t)) hit(G, s.from, s.t, s.dmg); }
    else { s.x += dx / d * v; s.y += dy / d * v; }
  }
  G.shots = G.shots.filter(s => !s.done);
}

// ---------- 이동 ----------
function moveUnit(G, u, goal, dt, mul) {
  const W = G.world;
  u.moving = false;
  if (!goal) return;
  const gd = hyp(goal.x - u.x, goal.y - u.y);
  const stopAt = goal.team ? u.d.range * 0.85 : (goal.follow > 0 ? 0.02 : 0.12);   // 같이 걷는 중이면 거의 붙어서 계속 걷기
  if (gd <= stopAt) return;
  if (goal.follow !== undefined) mul *= clamp(Math.max(goal.follow / u.d.spd, gd * 1.2 / u.d.spd), 0, 1);   // 기준점 속도에 맞춰 같이 걷기
  let tx = goal.x, ty = goal.y;
  // 막혀 있으면 길 찾기 (자주 하지 않게 0.5초마다)
  if (!lineClear(W, u.x, u.y, tx, ty) || !walkable(W, Math.floor(tx), Math.floor(ty))) {
    u.pathT -= dt;
    if (u.pathT <= 0 || !u.path || !u.path.length || !u.pathGoal || hyp(u.pathGoal.x - tx, u.pathGoal.y - ty) > 1.5) {
      u.pathT = 0.5; u.path = findPath(W, u.x, u.y, tx, ty, 2500); u.pathGoal = { x: tx, y: ty };
    }
    if (u.path && u.path.length) {
      while (u.path.length > 1 && hyp(u.path[0].x - u.x, u.path[0].y - u.y) < 0.4) u.path.shift();
      tx = u.path[0].x; ty = u.path[0].y;
    } else return;
  } else u.path = null;
  const dx = tx - u.x, dy = ty - u.y, d = hyp(dx, dy) || 1;
  const v = Math.min(d, u.d.spd * mul * dt);
  const nx = u.x + dx / d * v, ny = u.y + dy / d * v;
  if (walkable(W, Math.floor(nx), Math.floor(u.y))) u.x = nx;
  if (walkable(W, Math.floor(u.x), Math.floor(ny))) u.y = ny;
  if (v > 0.002) { u.moving = true; u.walkT = 0.25; u.face = faceOf(dx, dy); }
}
function separate(G) {
  const live = G.units.filter(alive), W = G.world;
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j], dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy);
    if (d < 0.62 && d > 0.001) {
      const push = (0.62 - d) * 0.25, px = dx / d * push, py = dy / d * push;
      if (walkable(W, Math.floor(a.x - px), Math.floor(a.y - py))) { a.x -= px; a.y -= py; }
      if (walkable(W, Math.floor(b.x + px), Math.floor(b.y + py))) { b.x += px; b.y += py; }
    }
  }
}

// 플레이어 명령
function orderMove(G, x, y) {
  const a = G.anchor, p = findPath(G.world, a.x, a.y, x, y);
  if (!p) { toast(G, '갈 수 없는 곳이에요'); return false; }
  a.mode = 'move'; a.dest = { x, y }; a.path = p;
  return true;
}
function toggleAuto(G) {
  const a = G.anchor;
  if (a.mode === 'auto') { a.mode = 'hold'; a.path = null; } else { a.mode = 'auto'; a.path = null; }
  return a.mode === 'auto';
}
