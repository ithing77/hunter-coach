// 사냥 시뮬레이션. 헌터와 몬스터가 스스로 움직이고, 플레이어는 큰 공격 예고 때 명령만 내린다.
// 화면과 상관없는 순수 계산이라, 나중에 멀티(방장 계산)로 그대로 옮길 수 있다.
// 좌표: x 0~ARENA.w, y 0~ARENA.h. 각도 a 는 라디안(0 = 오른쪽, 아래가 +y).

function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const hyp = Math.hypot, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const faceOf = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : (dy > 0 ? 2 : 0));   // LPC 줄 순서: 위0 왼1 아래2 오른3

function createHunt(seed) {
  const R = mulberry(seed || 7);
  const S = {
    R, t: 0, phase: 'hunt', cp: CP.start, cpT: 0, buffT: 0, faints: 0, log: [], fx: [], shots: [], windowReq: null,
    stats: { dmg: {}, counters: 0, evades: 0 },
    mon: {
      x: ARENA.w * 0.68, y: ARENA.h * 0.5, a: Math.PI, hp: MONSTER.hp, max: MONSTER.hp, state: 'idle', stT: 2.5, atk: null, zone: null,
      target: null, enraged: false, roared: false, flinchAcc: 0, spin: 0, z: 0, wing: 0, aggro: {}, hitSet: new Set(), walkT: 0, tailSway: 0,
    },
    hunters: HUNTERS.map((d, i) => ({
      id: d.id, d, x: 4 + (i % 2) * 2, y: ARENA.h / 2 - 3 + i * 2, vx: 0, vy: 0, face: 3, hp: d.hp, max: d.hp, st: 100,
      state: 'move', stT: 0, atkCd: 1 + i * 0.4, react: null, counterReady: false, healCd: 6, anim: 'idle', animT: 0, side: i % 2 ? 1 : -1, reviveT: 0,
    })),
  };
  S.hunters.forEach(h => { S.stats.dmg[h.id] = 0; S.mon.aggro[h.id] = 0; });
  log(S, `${MONSTER.name} 발견! 사냥 시작`);
  return S;
}
function log(S, text, big) { S.log.unshift({ t: S.t, text, big: !!big }); if (S.log.length > 40) S.log.pop(); }
function fx(S, o) { o.t = 0; S.fx.push(o); }

// ---------- 몬스터 몸 위치 ----------
function monParts(m) {
  const cx = Math.cos(m.a), cy = Math.sin(m.a);
  const sway = Math.sin(m.tailSway) * 0.5;
  const tail = [];
  for (let i = 1; i <= 6; i++) {
    const bend = sway * i * 0.18 + (m.spin ? 0 : 0);
    const ta = m.a + Math.PI + bend;
    const prev = i === 1 ? { x: m.x - cx * 1.6, y: m.y - cy * 1.6 } : tail[i - 2];
    tail.push({ x: prev.x + Math.cos(ta) * 0.95, y: prev.y + Math.sin(ta) * 0.95, r: Math.max(0.35, 1.0 - i * 0.11) });
  }
  return { head: { x: m.x + cx * 3.4, y: m.y + cy * 3.4, r: MONSTER.headR }, neck: { x: m.x + cx * 2.1, y: m.y + cy * 2.1 }, body: { x: m.x, y: m.y, r: MONSTER.body }, tail };
}
function nearestPart(m, x, y) {
  const P = monParts(m);
  let best = { part: 'body', p: P.body, d: hyp(x - P.body.x, y - P.body.y) - P.body.r };
  const dh = hyp(x - P.head.x, y - P.head.y) - P.head.r;
  if (dh < best.d) best = { part: 'head', p: P.head, d: dh };
  for (const t of P.tail) { const d = hyp(x - t.x, y - t.y) - t.r; if (d < best.d) best = { part: 'tail', p: t, d }; }
  return best;
}
const PART_MUL = { head: 1.5, body: 1, tail: 0.8 };

// ---------- 공격 범위 ----------
function makeZone(S, key) {
  const m = S.mon, P = monParts(m), tg = m.target;
  switch (key) {
    case 'bite': return { type: 'circle', x: P.head.x + Math.cos(m.a) * 0.6, y: P.head.y + Math.sin(m.a) * 0.6, r: 2.3 };
    case 'tail': return { type: 'spin', x: m.x, y: m.y, r: 6.8, a: m.a };
    case 'charge': { const L = 15; return { type: 'line', x1: m.x, y1: m.y, x2: clamp(m.x + Math.cos(m.a) * L, 1, ARENA.w - 1), y2: clamp(m.y + Math.sin(m.a) * L, 1, ARENA.h - 1), w: 2.1 }; }
    case 'breath': return { type: 'cone', x: P.head.x, y: P.head.y, a: m.a, r: 11.5, spread: 0.5 };
    case 'roar': return { type: 'circle', x: m.x, y: m.y, r: 9, roar: true };
    case 'slam': return { type: 'circle', x: tg ? tg.x : m.x, y: tg ? tg.y : m.y, r: 4.6 };
  }
}
function inZone(z, x, y) {
  if (!z) return false;
  if (z.type === 'circle') return hyp(x - z.x, y - z.y) < z.r;
  if (z.type === 'spin') return hyp(x - z.x, y - z.y) < z.r && Math.abs(angDiff(Math.atan2(y - z.y, x - z.x), z.a)) > 0.45;
  if (z.type === 'cone') { const d = hyp(x - z.x, y - z.y); return d < z.r && (d < 1.2 || Math.abs(angDiff(Math.atan2(y - z.y, x - z.x), z.a)) < z.spread); }
  if (z.type === 'line') {
    const dx = z.x2 - z.x1, dy = z.y2 - z.y1, L2 = dx * dx + dy * dy || 1;
    const u = clamp(((x - z.x1) * dx + (y - z.y1) * dy) / L2, 0, 1);
    return hyp(x - (z.x1 + dx * u), y - (z.y1 + dy * u)) < z.w;
  }
  return false;
}

// ---------- 한 칸 진행 ----------
const STEP = 1 / 30;
function stepHunt(S, dt) {
  if (S.phase !== 'hunt') return;
  S.t += dt;
  S.cpT += dt;
  if (S.cpT >= CP.regen) { S.cpT = 0; if (S.cp < CP.max) S.cp++; }
  if (S.buffT > 0) S.buffT -= dt;
  monsterStep(S, dt);
  for (const h of S.hunters) hunterStep(S, h, dt);
  shotsStep(S, dt);
  for (const f of S.fx) f.t += dt;
  S.fx = S.fx.filter(f => f.t < (f.life || 1));
  for (const id in S.mon.aggro) S.mon.aggro[id] *= Math.pow(0.85, dt);
  if (S.t >= RULES.timeLimit) { S.phase = 'lost'; S.endWhy = '시간이 다 됐어요'; }
}

// ---------- 몬스터 ----------
function pickTarget(S) {
  const m = S.mon;
  let best = null, bs = -1e9;
  for (const h of S.hunters) {
    if (h.state === 'faint') continue;
    const s = m.aggro[h.id] * 0.02 - hyp(h.x - m.x, h.y - m.y) * 0.25 + S.R() * 1.5;
    if (s > bs) { bs = s; best = h; }
  }
  return best;
}
function chooseAttack(S) {
  const m = S.mon, tg = m.target;
  if (m.enraged && !m.roared) { m.roared = true; return 'roar'; }
  const d = hyp(tg.x - m.x, tg.y - m.y), da = Math.abs(angDiff(Math.atan2(tg.y - m.y, tg.x - m.x), m.a));
  const w = {};
  if (da > 1.7 && d < 7.5) { w.tail = 5; w.turn = 1; }
  else if (da < 0.7) {
    if (d < 5.5) { w.bite = 4; w.breath = 1.5; w.tail = 0.8; }
    else if (d < 12) { w.breath = 2.5; w.charge = 2.5; w.walk = 1; }
    else { w.charge = 3; w.breath = 0.8; w.walk = 1.5; }
  } else { w.turn = 3; if (d < 7) w.tail = 1.5; }
  if (m.enraged && d > 5) w.slam = 1.8;
  if (S.R() < 0.06) w.roar = 1;
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  let r = S.R() * tot;
  for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) return k; }
  return 'turn';
}
function monsterStep(S, dt) {
  const m = S.mon;
  m.wing += dt * (m.state === 'act' && m.atk === 'slam' ? 14 : m.state === 'walk' || m.state === 'turn' ? 5 : 2.5);
  m.tailSway += dt * (m.state === 'walk' ? 4 : 1.6);
  if (m.state === 'dead') return;
  m.stT -= dt;
  const spd = MONSTER.speed * (m.enraged ? 1.25 : 1), teleMul = m.enraged ? 0.85 : 1;
  const tg = m.target && m.target.state !== 'faint' ? m.target : (m.target = pickTarget(S));
  const turnTo = (ang, rate) => { const d = angDiff(ang, m.a); m.a += clamp(d, -rate * dt, rate * dt); return Math.abs(d); };

  switch (m.state) {
    case 'idle':
      if (m.stT <= 0) {
        m.target = pickTarget(S);
        if (!m.target) { m.stT = 0.5; break; }
        const k = chooseAttack(S);
        if (k === 'turn') { m.state = 'turn'; m.stT = 1.2; }
        else if (k === 'walk') { m.state = 'walk'; m.stT = 1.2 + S.R(); }
        else startAttack(S, k, teleMul);
      }
      break;
    case 'turn': case 'walk': {
      if (!tg) { m.state = 'idle'; break; }
      const ang = Math.atan2(tg.y - m.y, tg.x - m.x);
      turnTo(ang, MONSTER.turn * (m.enraged ? 1.3 : 1));
      const go = m.state === 'walk' ? spd : spd * 0.35;
      m.x = clamp(m.x + Math.cos(m.a) * go * dt, 3, ARENA.w - 3); m.y = clamp(m.y + Math.sin(m.a) * go * dt, 3, ARENA.h - 3);
      if (m.stT <= 0) { m.state = 'idle'; m.stT = m.enraged ? 0.15 : 0.35; }
      break;
    }
    case 'aim': {   // 공격 전에 몸을 돌린다
      const ang = Math.atan2(tg.y - m.y, tg.x - m.x);
      if (turnTo(ang, MONSTER.turn * 1.4) < 0.2 || m.stT <= 0) beginTele(S);
      break;
    }
    case 'tele':
      if (m.atk === 'slam') m.z = Math.min(1, m.z + dt * 1.2);
      if (m.stT <= 0) { m.state = 'act'; m.actT = 0; m.hitSet = new Set(); m.chargeFrom = { x: m.x, y: m.y }; }
      break;
    case 'act': actStep(S, dt); break;
    case 'recover': case 'flinch': case 'stun':
      m.z = Math.max(0, m.z - dt * 3);
      if (m.stT <= 0) { m.state = 'idle'; m.stT = (m.enraged ? 0.6 : 1.1) + S.R() * 0.8; m.atk = null; m.zone = null; }
      break;
  }
  // 헌터가 몸에 겹치지 않게 밀어낸다
  const P = monParts(m);
  for (const h of S.hunters) {
    if (h.state === 'faint') continue;
    for (const c of [P.body, P.head]) {
      const d = hyp(h.x - c.x, h.y - c.y), need = c.r + 0.6;
      if (d < need && d > 0.001) { h.x = c.x + (h.x - c.x) / d * need; h.y = c.y + (h.y - c.y) / d * need; }
    }
    h.x = clamp(h.x, 0.8, ARENA.w - 0.8); h.y = clamp(h.y, 1, ARENA.h - 0.6);
  }
}
function startAttack(S, k, teleMul) {
  const m = S.mon;
  m.atk = k; m.teleMul = teleMul;
  if (k === 'bite' || k === 'breath' || k === 'charge') { m.state = 'aim'; m.stT = 1.2; }
  else beginTele(S);
}
function beginTele(S) {
  const m = S.mon, A = MONSTER.attacks[m.atk];
  m.state = 'tele'; m.stT = A.tele * m.teleMul;
  m.zone = makeZone(S, m.atk);
  if (A.big) S.windowReq = { atk: m.atk, warn: A.warn, n: A.n };
}
function actStep(S, dt) {
  const m = S.mon, A = MONSTER.attacks[m.atk];
  m.actT += dt;
  const hitAll = (dmg, test) => { for (const h of S.hunters) if (h.state !== 'faint' && !m.hitSet.has(h.id) && test(h)) { m.hitSet.add(h.id); resolveHit(S, h, dmg); } };
  let end = 0.5, rec = 1.0;
  switch (m.atk) {
    case 'bite': end = 0.35; rec = 0.7; if (m.actT > 0.12) hitAll(A.dmg, h => inZone(m.zone, h.x, h.y)); break;
    case 'tail': end = 0.75; rec = 1.1; m.a += dt * Math.PI * 2 / 0.7; if (m.actT > 0.2) hitAll(A.dmg, h => inZone({ ...m.zone, a: m.a }, h.x, h.y) || hyp(h.x - m.x, h.y - m.y) < m.zone.r); break;
    case 'charge': {
      end = 0.95; rec = 1.6;
      const z = m.zone, u = Math.min(1, m.actT / 0.85);
      m.x = z.x1 + (z.x2 - z.x1) * u; m.y = z.y1 + (z.y2 - z.y1) * u;
      hitAll(A.dmg, h => hyp(h.x - m.x, h.y - m.y) < 2.6);
      if (S.R() < 0.5) fx(S, { kind: 'dust', x: m.x - Math.cos(m.a) * 2, y: m.y - Math.sin(m.a) * 2, life: 0.6 });
      break;
    }
    case 'breath':
      end = 1.1; rec = 1.0;
      if (m.actT < 0.9) for (let i = 0; i < 2; i++) { const P = monParts(m), sp = (S.R() - 0.5) * 0.9; fx(S, { kind: 'fire', x: P.head.x, y: P.head.y, vx: Math.cos(m.a + sp) * (10 + S.R() * 5), vy: Math.sin(m.a + sp) * (10 + S.R() * 5), life: 0.75 }); }
      if (m.actT > 0.25) hitAll(A.dmg, h => inZone(m.zone, h.x, h.y));
      break;
    case 'roar':
      end = 0.9; rec = 0.6;
      if (m.actT > 0.1 && !m.roarFx) { m.roarFx = true; fx(S, { kind: 'ring', x: m.x, y: m.y, r: 9, life: 0.8 }); }
      if (m.actT > 0.1) hitAll(0, h => inZone(m.zone, h.x, h.y));
      break;
    case 'slam': {
      end = 0.35; rec = 1.8;
      const z = m.zone, u = Math.min(1, m.actT / 0.25);
      m.x += (z.x - m.x) * u * 0.6; m.y += (z.y - m.y) * u * 0.6; m.z = 1 - u;
      if (u >= 1) { if (!m.slamFx) { m.slamFx = true; fx(S, { kind: 'ring', x: z.x, y: z.y, r: z.r, life: 0.6 }); fx(S, { kind: 'shake', life: 0.4 }); } hitAll(A.dmg, h => inZone(z, h.x, h.y)); }
      break;
    }
  }
  if (m.actT >= end) {
    m.state = 'recover'; m.stT = rec; m.roarFx = false; m.slamFx = false; m.z = 0;
    m.x = clamp(m.x, 3, ARENA.w - 3); m.y = clamp(m.y, 3, ARENA.h - 3);
    for (const h of S.hunters) { if (h.react === 'counter') h.counterReady = true; h.react = null; }
  }
}

// 큰 공격이 헌터에게 닿았을 때: 명령(회피·가드·반격)이 여기서 효과를 낸다
function resolveHit(S, h, dmg) {
  const m = S.mon, roar = m.atk === 'roar', r = h.react, d = h.d;
  const away = () => { const a = Math.atan2(h.y - m.y, h.x - m.x); return { x: Math.cos(a), y: Math.sin(a) }; };
  if (r === 'evade' && S.R() < 0.95) return dodge(S, h, '회피 성공');
  if (r === 'guard') return guarded(S, h, roar ? 0 : dmg * d.guard, d.id !== 'B');
  if (r === 'counter') { h.counterReady = true; return guarded(S, h, roar ? 0 : dmg * (d.id === 'B' ? 0.2 : 0.5), false, '버티고 반격 준비!'); }
  // 명령이 없으면 헌터가 알아서 반응해 본다
  if (!roar && d.autoGuard && S.R() < d.autoGuard) return guarded(S, h, dmg * d.guard, false, '알아서 가드');
  if (S.R() < d.autoDodge * (roar ? 0.6 : 1)) return dodge(S, h, '알아서 피함');
  if (roar) { h.state = 'stun'; h.stT = 2.2; log(S, `${d.name}(${d.weapon}) 포효에 귀를 막고 굳었어요`); return; }
  const v = away();
  h.vx = v.x * 9; h.vy = v.y * 9;
  damage(S, h, dmg, true);
}
function dodge(S, h, text) {
  const m = S.mon, z = m.zone;
  let ax = h.x - m.x, ay = h.y - m.y;
  if (z && z.type === 'line') { const dx = z.x2 - z.x1, dy = z.y2 - z.y1, L = hyp(dx, dy) || 1, side = ((h.x - z.x1) * dy - (h.y - z.y1) * dx) > 0 ? 1 : -1; ax = dy / L * side; ay = -dx / L * side; }
  if (z && z.type === 'cone') { const a = z.a + (angDiff(Math.atan2(h.y - z.y, h.x - z.x), z.a) > 0 ? 1.4 : -1.4); ax = Math.cos(a); ay = Math.sin(a); }
  const l = hyp(ax, ay) || 1;
  h.state = 'evade'; h.stT = 0.5; h.vx = ax / l * 11; h.vy = ay / l * 11; h.anim = 'jump'; h.animT = 0;
  S.stats.evades++;
  fx(S, { kind: 'num', x: h.x, y: h.y - 1.5, text: text === '회피 성공' ? '회피!' : '휙', color: '#7fd4ff', life: 1 });
  log(S, `${h.d.name}(${h.d.weapon}) ${text}`);
}
function guarded(S, h, dmg, knock, text) {
  h.state = 'guarding'; h.stT = 0.6; h.anim = 'combat'; h.animT = 0;
  const m = S.mon, a = Math.atan2(h.y - m.y, h.x - m.x);
  h.vx = Math.cos(a) * (knock ? 5 : 2); h.vy = Math.sin(a) * (knock ? 5 : 2);
  fx(S, { kind: 'num', x: h.x, y: h.y - 1.5, text: dmg ? `가드 -${Math.round(dmg)}` : '가드!', color: '#ffe08a', life: 1 });
  log(S, `${h.d.name}(${h.d.weapon}) ${text || '가드'}${dmg ? ` (-${Math.round(dmg)})` : ''}`);
  if (dmg) damage(S, h, dmg, false, true);
}
function damage(S, h, dmg, knock, quiet) {
  h.hp -= dmg;
  if (!quiet) {
    fx(S, { kind: 'num', x: h.x, y: h.y - 1.5, text: `-${Math.round(dmg)}`, color: '#ff7a6b', life: 1 });
    log(S, `${h.d.name}(${h.d.weapon}) ${MONSTER.attacks[S.mon.atk].n}에 맞음 (-${Math.round(dmg)})`);
  }
  if (h.hp <= 0) {
    h.hp = 0; h.state = 'faint'; h.reviveT = RULES.reviveSeconds; h.react = null; h.counterReady = false;
    S.faints++;
    log(S, `${h.d.name}(${h.d.weapon}) 쓰러졌어요! (${S.faints}/${RULES.faintsToFail})`, true);
    if (S.faints >= RULES.faintsToFail) { S.phase = 'lost'; S.endWhy = `헌터가 ${RULES.faintsToFail}번 쓰러졌어요`; }
  } else if (knock) { h.state = 'down'; h.stT = 1.3; h.anim = 'hurt'; h.animT = 0; }
}

// 몬스터에게 대미지
function hitMonster(S, h, base, x, y, big) {
  const m = S.mon;
  if (m.state === 'dead') return;
  const np = nearestPart(m, x, y);
  const dmg = Math.round(base * PART_MUL[np.part] * (S.buffT > 0 ? 1.4 : 1) * (0.9 + S.R() * 0.2) * (m.state === 'stun' || m.state === 'flinch' ? 1.15 : 1));
  m.hp -= dmg; m.flinchAcc += dmg; m.aggro[h.id] += dmg; S.stats.dmg[h.id] += dmg;
  fx(S, { kind: 'num', x: np.p.x + (S.R() - 0.5), y: np.p.y - 1, text: String(dmg), color: np.part === 'head' ? '#ffd23f' : '#ffffff', big, life: big ? 1.4 : 0.9 });
  fx(S, { kind: 'spark', x: np.p.x, y: np.p.y, life: 0.25 });
  if (m.hp <= 0) {
    m.hp = 0; m.state = 'dead'; m.zone = null; m.atk = null; S.phase = 'won';
    log(S, `${MONSTER.name} 토벌 성공!`, true);
    return;
  }
  if (!m.enraged && m.hp < m.max * MONSTER.enrageAt) { m.enraged = true; log(S, `${MONSTER.name}이(가) 분노했어요! 더 빠르고 사나워져요`, true); }
  if (m.flinchAcc >= MONSTER.flinchEvery && (m.state === 'idle' || m.state === 'walk' || m.state === 'turn' || m.state === 'recover' || (big && m.state === 'tele'))) {
    m.flinchAcc = 0;
    if (m.state === 'tele') { S.windowReq = null; log(S, `큰 한 방에 ${MONSTER.attacks[m.atk].n}이(가) 끊겼어요!`, true); }
    m.state = 'flinch'; m.stT = 1.5; m.atk = null; m.zone = null; m.z = 0;
    fx(S, { kind: 'num', x: m.x, y: m.y - 3, text: '움찔!', color: '#ffb347', life: 1.1 });
  }
}

// ---------- 헌터 ----------
function hunterStep(S, h, dt) {
  const m = S.mon, d = h.d;
  h.animT += dt;
  h.st = Math.min(100, h.st + dt * 12);
  if (h.state === 'faint') {
    h.reviveT -= dt;
    if (h.reviveT <= 0 && S.phase === 'hunt') { h.state = 'move'; h.hp = h.max; h.x = 2; h.y = ARENA.h / 2; h.st = 100; log(S, `${d.name}(${d.weapon}) 캠프에서 다시 돌아왔어요`); }
    return;
  }
  // 밀려나는 움직임
  h.x += h.vx * dt; h.y += h.vy * dt; h.vx *= Math.pow(0.02, dt); h.vy *= Math.pow(0.02, dt);
  if (['down', 'evade', 'guarding', 'stun', 'drink', 'cast', 'attack', 'counter'].includes(h.state)) {
    h.stT -= dt;
    if (h.state === 'attack' || h.state === 'counter') attackTick(S, h);
    if (h.stT <= 0) { if (h.state === 'drink' || h.state === 'cast') finishItem(S, h); h.state = 'move'; h.atkCd = Math.min(h.atkCd, 0.4); }
    else return;
  }
  if (m.state === 'dead') { h.anim = 'idle'; return; }
  h.atkCd -= dt; h.healCd -= dt;

  // 지팡이: 다친 동료를 조금씩 치료
  if (d.healer && h.healCd <= 0) {
    const hurt = S.hunters.filter(o => o.state !== 'faint' && o.hp < o.max * 0.55).sort((a, b) => a.hp / a.max - b.hp / b.max)[0];
    if (hurt) { h.state = 'cast'; h.stT = 1.0; h.item = { kind: 'smallheal', to: hurt }; h.anim = 'attack'; h.animT = 0; h.healCd = 11; h.face = faceOf(hurt.x - h.x, hurt.y - h.y); return; }
  }
  // 어디에 설지 정한다
  const P = monParts(m), dir = { x: Math.cos(m.a), y: Math.sin(m.a) }, perp = { x: -dir.y * h.side, y: dir.x * h.side };
  let tx, ty, aimX, aimY;
  if (h.counterReady) {
    aimX = d.prefer === 'head' ? P.head.x : P.body.x; aimY = d.prefer === 'head' ? P.head.y : P.body.y;
    const reach = d.ranged ? d.range - 1 : (d.prefer === 'head' ? P.head.r : P.body.r) + 0.9;
    const a = Math.atan2(h.y - aimY, h.x - aimX);
    tx = aimX + Math.cos(a) * reach; ty = aimY + Math.sin(a) * reach;
  } else if (!d.ranged) {
    if (d.prefer === 'head') { tx = P.head.x + perp.x * 1.9 - dir.x * 0.4; ty = P.head.y + perp.y * 1.9 - dir.y * 0.4; aimX = P.head.x; aimY = P.head.y; }
    else { tx = P.body.x + perp.x * (P.body.r + 0.9); ty = P.body.y + perp.y * (P.body.r + 0.9); aimX = P.body.x; aimY = P.body.y; }
  } else {
    const r = d.range - 1.5;
    tx = m.x + perp.x * r - dir.x * 2; ty = m.y + perp.y * r - dir.y * 2;
    aimX = d.id === 'C' ? P.head.x : P.body.x; aimY = d.id === 'C' ? P.head.y : P.body.y;
  }
  tx = clamp(tx, 1, ARENA.w - 1); ty = clamp(ty, 1.2, ARENA.h - 0.8);
  const dx = tx - h.x, dy = ty - h.y, dist = hyp(dx, dy);
  const inRange = d.ranged ? hyp(aimX - h.x, aimY - h.y) < d.range + 0.5 : nearestPart(m, h.x, h.y).d < d.range * 0.6;
  if (dist > 0.4 && !(inRange && dist < 1.4)) {
    const run = dist > 4;
    const s = d.spd * (run ? 1.35 : 1);
    h.x += dx / dist * s * dt; h.y += dy / dist * s * dt;
    h.face = faceOf(dx, dy); h.anim = run ? 'run' : 'walk';
    if (run) h.st = Math.max(0, h.st - dt * 18);
    if (h.side && S.R() < dt * 0.05) h.side = -h.side;
    return;
  }
  h.face = faceOf(aimX - h.x, aimY - h.y);
  if (h.counterReady) { startAttack2(S, h, 'counter', aimX, aimY); return; }
  if (h.atkCd <= 0 && inRange) { startAttack2(S, h, 'attack', aimX, aimY); return; }
  h.anim = 'combat';
}
function startAttack2(S, h, kind, ax, ay) {
  const d = h.d;
  h.state = kind; h.stT = d.atkTime * (kind === 'counter' ? 1.3 : 1); h.anim = 'attack'; h.animT = 0;
  h.aim = { x: ax, y: ay }; h.hitDone = false;
  if (kind === 'counter') { h.counterReady = false; fx(S, { kind: 'num', x: h.x, y: h.y - 1.8, text: '반격!', color: '#ffb347', life: 0.9 }); }
}
function attackTick(S, h) {
  const d = h.d, total = d.atkTime * (h.state === 'counter' ? 1.3 : 1);
  if (h.hitDone || (total - h.stT) < d.hitAt * total) return;
  h.hitDone = true;
  const big = h.state === 'counter', base = big ? d.counter : d.atk;
  if (big) { S.stats.counters++; log(S, `${d.name}(${d.weapon}) 반격 명중!`, true); }
  if (d.ranged) S.shots.push({ x: h.x, y: h.y - 0.6, tx: h.aim.x, ty: h.aim.y, h, base, big, kind: d.id === 'C' ? 'arrow' : 'bolt' });
  else if (nearestPart(S.mon, h.x, h.y).d < d.range) hitMonster(S, h, base, h.aim.x, h.aim.y, big);
  if (!big) h.atkCd = d.atkTime * 0.15;
}
function shotsStep(S, dt) {
  for (const s of S.shots) {
    const dx = s.tx - s.x, dy = s.ty - s.y, l = hyp(dx, dy), v = 24 * dt;
    if (l <= v) { s.done = true; hitMonster(S, s.h, s.base, s.tx, s.ty, s.big); }
    else { s.x += dx / l * v; s.y += dy / l * v; s.a = Math.atan2(dy, dx); }
  }
  S.shots = S.shots.filter(s => !s.done);
}
function finishItem(S, h) {
  const it = h.item; h.item = null;
  if (!it) return;
  if (it.kind === 'smallheal') { const o = it.to; if (o.state !== 'faint') { o.hp = Math.min(o.max, o.hp + 22); fx(S, { kind: 'num', x: o.x, y: o.y - 1.5, text: '+22', color: '#8dff9a', life: 1 }); } }
  if (it.kind === 'potion') { h.hp = Math.min(h.max, h.hp + 45); fx(S, { kind: 'num', x: h.x, y: h.y - 1.5, text: '+45', color: '#8dff9a', life: 1 }); }
  if (it.kind === 'groupheal') for (const o of S.hunters) if (o.state !== 'faint' && hyp(o.x - h.x, o.y - h.y) < 10) { o.hp = Math.min(o.max, o.hp + 35); fx(S, { kind: 'num', x: o.x, y: o.y - 1.5, text: '+35', color: '#8dff9a', life: 1 }); }
  if (it.kind === 'buff') { S.buffT = 20; log(S, '응원가! 20초 동안 모두 공격력 +40%', true); fx(S, { kind: 'ring', x: h.x, y: h.y, r: 10, color: '#c9a7ff', life: 0.8 }); }
}

// ---------- 명령 ----------
function commandOK(S, hid, cid) {
  const h = S.hunters.find(x => x.id === hid), c = COMMANDS.find(x => x.id === cid);
  if (!h || !c || h.state === 'faint') return false;
  if (c.only && c.only !== hid) return false;
  if (c.notFor && c.notFor === hid) return false;
  return true;
}
// 명령 창을 닫을 때 한꺼번에 적용한다. cmds = { A: 'evade', ... }
function applyCommands(S, cmds) {
  let cost = 0;
  for (const [hid, cid] of Object.entries(cmds)) {
    if (!cid || !commandOK(S, hid, cid)) continue;
    const c = COMMANDS.find(x => x.id === cid);
    if (cost + c.cost > S.cp) continue;
    cost += c.cost;
    const h = S.hunters.find(x => x.id === hid), d = h.d, who = `${d.name}(${d.weapon})`;
    if (cid === 'evade' || cid === 'guard' || cid === 'counter') { h.react = cid; log(S, `${who}에게 [${c.n}] 명령`); }
    if (cid === 'heal') { h.state = d.healer ? 'cast' : 'drink'; h.stT = 0.9; h.anim = d.healer ? 'attack' : 'combat'; h.animT = 0; h.item = { kind: d.healer ? 'groupheal' : 'potion' }; log(S, `${who} ${d.healer ? '회복 마법' : '물약'}`); }
    if (cid === 'buff') { h.state = 'cast'; h.stT = 1.0; h.anim = 'attack'; h.animT = 0; h.item = { kind: 'buff' }; }
    if (cid === 'flash') {
      const m = S.mon;
      fx(S, { kind: 'flash', life: 0.5 });
      if (m.state === 'tele' || m.state === 'aim' || m.state === 'act') { log(S, `${who} 섬광탄! ${MONSTER.attacks[m.atk].n}이(가) 끊기고 몬스터가 눈이 멀었어요`, true); }
      else log(S, `${who} 섬광탄! 몬스터가 눈이 멀었어요`, true);
      m.state = 'stun'; m.stT = 3.5; m.atk = null; m.zone = null; m.z = 0;
      for (const o of S.hunters) o.react = null;
    }
  }
  S.cp -= cost;
}

if (typeof module !== 'undefined') module.exports = { createHunt, stepHunt, applyCommands, commandOK, monParts, inZone, STEP, faceOf };
