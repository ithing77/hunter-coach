// 헌터 머리 (기획안의 줄인 구조)
//   1) 공유 메모판(board): 집중 표적·기사가 잡은 적·뒷줄 위협·힐 예약·피해 예약·재집결 지점, 그리고 국면
//   2) 국면 5개: 모이기 → 교전 ⇄ 위기 → 후퇴 → 재집결 → 교전
//   3) 역할 우선순위 줄을 위에서부터 보며, 줄마다 꼬리표 점수(SCORE)로 행동 후보를 매긴다
//   4) 떨림 막기: 표적은 1초 유지하고 20% 이상 좋아야 바꿈 / 자리는 1칸 넘게 달라질 때만 옮김
// 판단 과정은 u.thought 에 남기고, 결정이 바뀌면 G.log 에 한 줄 적는다 (생각 보기 창).

function makeBoard(G) {
  return { phase: 'gather', phaseT: 0, why: '시작', focus: null, focusWhy: '', focusT: 0, tankHeld: [], backThreat: [], low: [],
    healClaims: new Map(), pending: new Map(), regroup: null, updT: 0, calmT: 0, retreated: false, fwd: { x: 1, y: 0 } };
}
const partyName = G => (G.custom ? (G.me === 'e' ? '오른편' : '왼편') : '파티');
function setPhase(G, ph, why) {
  const B = G.board;
  if (B.phase === ph) return;
  B.phase = ph; B.phaseT = 0; B.why = why; B.calmT = 0;
  G.log.push({ t: G.t, id: -1, name: partyName(G), text: `국면 → ${PHASE_NAMES[ph]}`, why, phase: true });
}

function updateBoard(G, dt) {
  const B = G.board, S = G.style;
  B.phaseT += dt; B.updT -= dt;
  // 피해 예약 (매 틱): 날아가는 화살 + 휘두르는 중인 공격 + 조준 중인 사격
  B.pending.clear();
  const addP = (e, v) => B.pending.set(e.id, (B.pending.get(e.id) || 0) + v * (1 - e.d.armor));
  for (const s of G.shots) if (s.from.team === G.me) addP(s.t, s.dmg);
  for (const h of liveHeroes(G)) {
    if (h.state === 'attack' && !h.hitDone && h.atkTarget) addP(h.atkTarget, h.d.atk);
    if (h.state === 'cast' && h.cast.k === 'aimed' && h.cast.t) addP(h.cast.t, h.d.atk * SKILLS.aimed.mult);
  }
  for (const [id, c] of B.healClaims) if (c.until < G.t - 0.05) B.healClaims.delete(id);
  if (B.updT > 0) return;
  B.updT = 0.25;
  const hs = liveHeroes(G), es = liveFoes(G);
  if (!hs.length || !es.length) return;
  const tank = hs.find(h => h.d.role === 'tank');
  B.tankHeld = tank ? es.filter(e => e.target === tank) : [];
  B.backThreat = es.filter(e => e.d.melee && e.target && alive(e.target) && isBack(e.target) && dist(e, e.target) < 3);
  B.low = hs.filter(h => h.hp / h.max < S.board.crisisHp);
  const pc = centroid(hs), ec = centroid(es);
  B.fwd = unitv(ec.x - pc.x, ec.y - pc.y);
  if (!B.regroup) B.regroup = { x: pc.x, y: pc.y };
  // 집중 표적: 2초 유지 (죽거나 뒷줄이 맞으면 바로 바꿈)
  B.focusT -= 0.25;
  if (!B.focus || !alive(B.focus) || B.focusT <= 0 || (B.backThreat.length && !B.backThreat.includes(B.focus))) {
    let f, why;
    if (B.backThreat.length) { f = B.backThreat.slice().sort((a, b) => a.hp - b.hp)[0]; why = `뒷줄(${f.target.d.name})을 치는 적`; }
    else if (tank && tank.tgt && alive(tank.tgt)) { f = tank.tgt; why = '기사가 잡고 있는 적'; }
    else { f = es.slice().sort((a, b) => a.hp - b.hp)[0]; why = '체력이 제일 적은 적'; }
    if (f !== B.focus) { B.focusT = 2; if (B.focus) G.log.push({ t: G.t, id: -1, name: partyName(G), text: `집중 표적 → ${f.label}`, why }); }
    B.focus = f; B.focusWhy = why;
  }
  // 국면
  const minD = Math.min(...es.map(e => Math.min(...hs.map(h => dist(e, h)))));
  const all = G.units.filter(u => u.team === G.me);
  const avg = all.reduce((a, h) => a + h.hp, 0) / all.reduce((a, h) => a + h.max, 0);
  const foeHp = es.reduce((a, e) => a + e.hp, 0), partyHp = hs.reduce((a, h) => a + h.hp, 0);
  const wantRetreat = S.board.retreatHp > 0 && !B.retreated && avg < S.board.retreatHp && foeHp > partyHp * 0.5;
  const crisisWhy = B.low.length ? `${B.low.map(h => h.d.name).join('·')} 체력 ${Math.round(S.board.crisisHp * 100)}% 아래` : B.backThreat.length ? `${[...new Set(B.backThreat.map(e => e.target.d.name))].join('·')}이(가) 근접 공격당함` : '';
  const goRetreat = () => { B.retreated = true; B.regroup = inArena({ x: pc.x - B.fwd.x * 5, y: pc.y - B.fwd.y * 5 }); setPhase(G, 'retreat', `파티 체력 ${Math.round(avg * 100)}% < ${Math.round(S.board.retreatHp * 100)}%`); };
  switch (B.phase) {
    case 'gather':
      if (minD < 8) setPhase(G, 'engage', `적이 ${minD.toFixed(1)}칸 앞`);
      else if (B.phaseT > 5) setPhase(G, 'engage', '모이기 끝');
      break;
    case 'engage':
      if (wantRetreat) goRetreat();
      else if (crisisWhy) setPhase(G, 'crisis', crisisWhy);
      break;
    case 'crisis':
      if (wantRetreat) { goRetreat(); break; }
      if (!crisisWhy && !hs.some(h => h.hp / h.max < S.board.crisisHp + 0.1)) { B.calmT += 0.25; if (B.calmT >= 1.5) setPhase(G, 'engage', '위기 넘김 (1.5초 조용)'); }
      else B.calmT = 0;
      break;
    case 'retreat':
      if (B.phaseT > 4) setPhase(G, 'regroup', '4초 물러남');
      else if (minD > 6) setPhase(G, 'regroup', '거리 6칸 벌림');
      break;
    case 'regroup':
      if (B.phaseT > 2.5) setPhase(G, 'engage', '정비 끝');
      else if (minD < 2.5) setPhase(G, 'engage', '적이 따라붙음');
      break;
  }
}
const isBack = h => h.d.role === 'healer' || h.d.role === 'archer';

// ---------- 생각하기 ----------
function think(G, u) {
  const B = G.board, S = G.style, role = u.d.role;
  const prio = PHASE_PRIORITY[B.phase] || S.priority[role] || PRIORITY[role];
  const th = { t: G.t, phase: B.phase, prio, tiers: [], pick: null };
  let pick = null;
  for (const tag of prio) {
    const tier = { tag, cands: [] };
    for (const a of actionsFor(u, tag, prio)) {
      const r = SCORE[tag](G, u, a);
      if (!r) continue;
      r.score *= 1 + (u.expAdj[tag] || 0);   // 경험 보정 자리 (지금은 0, 나중에 ±15%)
      tier.cands.push(r);
    }
    tier.cands.sort((a, b) => b.score - a.score);
    th.tiers.push(tier);
    if (tier.cands.length && tier.cands[0].score >= MIN_SCORE) { pick = tier.cands[0]; tier.picked = true; break; }
  }
  if (!pick) pick = { label: '대기', short: '…', score: 0, why: '점수 넘는 행동 없음', plan: null };
  if (pick.commit) pick.commit();
  th.pick = pick;
  u.thought = th;
  const prev = u.plan && u.plan.label;
  u.plan = pick.plan ? { ...pick.plan, label: pick.label } : null;
  if (pick.label !== prev) {
    G.log.push({ t: G.t, id: u.id, name: u.label, text: pick.label, why: pick.why, tag: th.tiers.length ? th.tiers[th.tiers.length - 1].tag : '' });
    u.say = pick.short || pick.label; u.sayT = 1.6;
    if (G.log.length > 800) G.log.splice(0, 200);
  }
}
// 이 줄(꼬리표)에서 볼 행동들. 스킬은 우선순위 줄에서 자기 꼬리표가 처음 나오는 줄에서만 본다.
const BUILTIN = { '피하기': 1, '거리두기': 1, '공격': 1, '모이기': 1, '후퇴': 1 };
function actionsFor(u, tag, prio) {
  const out = [];
  if (BUILTIN[tag]) out.push({ basic: true });
  for (const k of u.d.skills || []) {
    const s = SKILLS[k];
    if (prio.find(t => s.tags.includes(t)) === tag) out.push({ skill: k });
  }
  return SCORE[tag] ? out : [];
}

// ---------- 꼬리표 점수 ----------
// 하나하나가 "이 꼬리표의 행동을 지금 하면 얼마나 좋은가"를 0~1 로 매기고 이유(why)를 남긴다.
function rateTargets(G, u) {
  const B = G.board, W = G.style.w.target, es = liveFoes(G);
  if (!es.length) return [];
  const maxDps = Math.max(...es.map(e => e.d.atk / e.d.atkTime));
  const meleeLeft = es.some(e => e.d.melee);
  return es.map(e => {
    const myHit = u.d.atk * (1 - e.d.armor), left = e.hp - (B.pending.get(e.id) || 0);
    let danger = (e.d.atk / e.d.atkTime) / maxDps;
    if (e.target && isBack(e.target)) danger = Math.min(1, danger + 0.4);                         // 뒷줄을 노리는 적
    if (B.phase === 'crisis' && e.target && B.low.includes(e.target)) danger = Math.min(1, danger + 0.4);   // 위기: 약한 동료를 치는 적
    if (u.d.role === 'tank' && e.target === u) danger *= 0.5;                                      // 이미 나를 보는 적은 덜 급함
    const kill = left <= 0 ? 0 : clamp(1 - (left - myHit) / (myHit * 3), 0, 1);
    const near = 1 - clamp(Math.max(0, dist(u, e) - u.d.range) / 8, 0, 1);
    const focus = e === B.focus ? 1 : 0;
    const over = left <= 0 ? 0.6 : 0;   // 이미 날아가는 공격으로 죽을 적
    // 도망치는 적: 근접 헌터가 쫓으면 계속 달아나 다른 적까지 끌고 다닌다. 근접 적이 남아 있으면 반만 본다
    //   (원거리 적만 남으면 그땐 잡으러 간다)
    const flee = u.d.melee && e.d.keepAway && meleeLeft ? 0.5 : 1;
    const v = (W.danger * danger + W.kill * kill + W.near * near + W.focus * focus) * flee - over;
    return { e, v, parts: { danger, kill, near, focus, over, flee } };
  }).sort((a, b) => b.v - a.v);
}
const fmtT = r => `위험 ${r.parts.danger.toFixed(2)} · 막타 ${r.parts.kill.toFixed(2)} · 가까움 ${r.parts.near.toFixed(2)} · 집중 ${r.parts.focus}` + (r.parts.flee < 1 ? ' · 도망치는 적 ×0.5' : '') + (r.parts.over ? ' · 이미 죽을 적 −0.6' : '');
function warnOn(G, p, pad) { return G.warns.find(w => !w.done && dist(w, p) < w.r + (pad || 0.3)); }
function incomingDps(G, h) {
  let v = 0;
  for (const e of liveFoes(G)) if (e.target === h && dist(e, h) < e.d.range + 1.5) v += e.d.atk / e.d.atkTime * (1 - h.d.armor);
  const w = warnOn(G, h, 0);
  if (w) v += w.dmg / Math.max(0.3, w.warn - w.T);
  return v;
}
function notReady(u, k) {
  const s = SKILLS[k];
  if ((u.cd[k] || 0) > 0) return `쿨타임 ${u.cd[k].toFixed(1)}초`;
  if (s.mana && u.mana < s.mana) return `마나 부족 ${Math.floor(u.mana)}/${s.mana}`;
  return '';
}
function formationSpot(G, u) {
  const B = G.board, f = B.fwd, side = { x: -f.y, y: f.x }, c = B.regroup || u;
  const off = { tank: [1.2, 0], dealer: [0.6, 1.3], archer: [-1.6, -1.2], healer: [-2, 1] }[u.d.role] || [0, 0];
  return inArena({ x: c.x + f.x * off[0] + side.x * off[1], y: c.y + f.y * off[0] + side.y * off[1] });
}
function bestSpot(G, u) {
  const es = liveFoes(G), mel = es.filter(e => e.d.melee), hs = liveHeroes(G).filter(h => h !== u), tank = hs.find(h => h.d.role === 'tank');
  const t = u.tgt && alive(u.tgt) ? u.tgt : nearest(u, es);
  let best = null;
  for (let i = 0; i <= 12; i++) {
    const p = i === 12 ? { x: u.x, y: u.y } : inArena({ x: u.x + Math.cos(i / 12 * Math.PI * 2) * 2.4, y: u.y + Math.sin(i / 12 * Math.PI * 2) * 2.4 });
    const md = mel.length ? Math.min(...mel.map(e => dist(e, p))) : 9;
    let v = 0.45 * clamp(md / 6, 0, 1);
    if (u.d.role === 'healer') v += 0.3 * hs.filter(h => dist(h, p) <= SKILLS.heal.range - 0.5).length / Math.max(1, hs.length);
    else if (tank && dist(tank, p) < 6) v += 0.3;
    if (t && dist(t, p) <= u.d.range - 0.3) v += 0.2;
    if (G.warns.some(w => !w.done && dist(w, p) < w.r + 0.3)) v -= 1;
    const edge = Math.min(p.x, p.y, ARENA.w - p.x, ARENA.h - p.y);
    if (edge < 1.2) v -= 0.25 * (1.2 - edge);
    if (!best || v > best.v) best = { x: p.x, y: p.y, v };
  }
  return best;
}

const SCORE = {
  // 예고된 공격(내려찍기) 원 안이면 밖으로. 시간 안에 못 나가고 방패가 있으면 방어 줄로 넘긴다.
  '피하기'(G, u) {
    const w = warnOn(G, u);
    if (!w) return { label: '피하기', score: 0, why: '예고된 공격 없음' };
    const left = w.warn - w.T;
    let spot = null, need = 1e9;
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, p = inArena({ x: w.x + Math.cos(a) * (w.r + 0.7), y: w.y + Math.sin(a) * (w.r + 0.7) });
      if (dist(p, w) < w.r + 0.3) continue;
      const n = dist(u, p) / u.d.spd;
      if (n < need) { need = n; spot = p; }
    }
    if (!spot) return { label: '피하기', score: 0, why: '나갈 곳 없음' };
    if (need > left && (u.d.skills || []).includes('block') && skillReady(u, 'block'))
      return { label: '피하기', score: 0.1, why: `나가는 데 ${need.toFixed(1)}초, 남은 시간 ${left.toFixed(1)}초 → 방패로 받기` };
    return { label: '피하기', short: '💨 피하기', score: 1, why: `내려찍기 ${left.toFixed(1)}초 뒤 · 원 밖까지 ${need.toFixed(1)}초`, plan: { kind: 'move', spot } };
  },
  // 다른 헌터(특히 뒷줄)를 노리는 적을 끌어온다
  '보호'(G, u, a) {
    if (!a.skill) return null;
    const s = SKILLS[a.skill], nr = notReady(u, a.skill);
    if (nr) return { label: s.n, score: 0, why: nr };
    // 도망치는 적은 이미 범위 안일 때만 센다 (쫓아가서 도발하면 계속 달아남)
    const reach = liveFoes(G).filter(e => e.target && e.target !== u && e.forcedT <= 0 && dist(e, u) <= (e.d.keepAway ? s.radius : s.radius + 3));
    const back = reach.filter(e => isBack(e.target));
    if (!reach.length) return { label: s.n, score: 0, why: '나 말고 다른 헌터를 노리는 적 없음' };
    let v = 0.12 * reach.length + 0.25 * back.length;
    if (G.board.phase === 'crisis') v *= 1.3;
    const stay = reach.filter(e => !e.d.keepAway), sb = stay.filter(e => isBack(e.target));
    const c = sb.length ? nearest(u, sb) : stay.length ? nearest(u, stay) : nearest(u, reach);
    const walk = c.d.keepAway ? s.radius : s.radius - 1;   // 도망치는 적 쪽으로는 더 다가가지 않고 그 자리에서 도발
    return { label: `${s.n} (${reach.length}마리)`, short: `📢 ${s.n}`, score: Math.min(1, v), why: `다른 헌터를 노리는 적 ${reach.length} · 그중 뒷줄 ${back.length}${G.board.phase === 'crisis' ? ' · 위기 ×1.3' : ''}`,
      plan: { kind: 'skill', skill: a.skill, target: c, reach: walk } };
  },
  // 나에게 큰 피해가 오고 있으면 막기
  '방어'(G, u, a) {
    if (!a.skill) return null;
    const s = SKILLS[a.skill], nr = notReady(u, a.skill);
    if (nr) return { label: s.n, score: 0, why: nr };
    const w = warnOn(G, u);
    if (w) {
      const left = w.warn - w.T, need = Math.max(0, w.r + 0.5 - dist(u, w)) / u.d.spd;
      if (need > left - 0.1) return { label: s.n, short: `🛡 ${s.n}`, score: 0.95, why: `내려찍기를 못 피함 (${left.toFixed(1)}초 남음)`, plan: { kind: 'skill', skill: a.skill, target: u } };
    }
    const atk = liveFoes(G).filter(e => e.target === u && dist(e, u) < e.d.range + 1.5);
    const soon = atk.some(e => e.d.skills && e.d.skills.includes('slam') && (e.cd.slam || 0) < 1.5);
    const v = 0.16 * atk.length + (soon ? 0.25 : 0) + (1 - u.hp / u.max) * 0.35 - 0.1;
    return { label: s.n, short: `🛡 ${s.n}`, score: Math.max(0, v), why: `나를 치는 적 ${atk.length}${soon ? ' · 곧 내려찍기' : ''} · 체력 ${Math.round(u.hp / u.max * 100)}%`, plan: { kind: 'skill', skill: a.skill, target: u } };
  },
  // 범위 스킬: 주변 적이 많을수록
  '범위'(G, u, a) {
    if (!a.skill) return null;
    const s = SKILLS[a.skill], nr = notReady(u, a.skill);
    if (nr) return { label: s.n, score: 0, why: nr };
    const inR = liveFoes(G).filter(e => dist(e, u) <= s.radius + 0.2);
    const big = inR.some(e => e.d.scale);
    let v = inR.length >= 2 ? 0.4 + 0.15 * (inR.length - 2) : big ? 0.35 : 0.1 * inR.length;
    return { label: `${s.n} (${inR.length}마리)`, short: `🌀 ${s.n}`, score: Math.min(1, v), why: `범위 안 적 ${inR.length}${inR.length < 2 ? (big ? ' · 큰 적이라 하나라도 씀' : ' (2마리 이상일 때 씀)') : ''}`, plan: { kind: 'skill', skill: a.skill, target: u } };
  },
  // 강한 한 방: 체력 많은 적에게, 근접 적이 멀 때만 (조준하는 동안 못 움직임)
  '강공격'(G, u, a) {
    if (!a.skill) return null;
    const s = SKILLS[a.skill], nr = notReady(u, a.skill);
    if (nr) return { label: s.n, score: 0, why: nr };
    const dmg = u.d.atk * s.mult;
    const rs = rateTargets(G, u).filter(r => dist(u, r.e) <= s.range && r.e.hp - (G.board.pending.get(r.e.id) || 0) > dmg * 0.6);
    if (!rs.length) return { label: s.n, score: 0, why: '사거리 안에 맞을 만한 적 없음' };
    const m = nearest(u, liveFoes(G), e => e.d.melee), md = m ? dist(m, u) : 99;
    const t = rs[0].e;
    if (md < 3.5) return { label: `${s.n} → ${t.label}`, score: 0.1, why: `근접 적 ${md.toFixed(1)}칸 → ${s.cast}초 조준은 위험` };
    return { label: `${s.n} → ${t.label}`, short: `🎯 ${s.n}`, score: 0.35 + 0.3 * clamp(t.hp / (dmg * 2), 0, 1), why: `${t.label} 체력 ${Math.round(t.hp)} · 근접 적 ${md > 50 ? '없음' : md.toFixed(1) + '칸'} (안전)`, plan: { kind: 'skill', skill: a.skill, target: t } };
  },
  // 힐: 빠진 체력 · 급함(곧 죽나) · 역할. 예약된 힐 빼고, 넘치는 힐 줄이고, 마나 아끼기
  '회복'(G, u, a) {
    if (!a.skill) return null;
    const s = SKILLS[a.skill], nr = notReady(u, a.skill), B = G.board, W = G.style.w.heal;
    if (nr) return { label: s.n, score: 0, why: nr };
    let best = null;
    for (const h of liveHeroes(G)) {
      const c = B.healClaims.get(h.id), claimed = c ? c.amt : 0;
      const missAmt = h.max - h.hp - claimed, miss = clamp(missAmt / h.max, 0, 1);
      const dps = incomingDps(G, h), urg = dps > 0 ? clamp(1 - h.hp / dps / 8, 0, 1) : 0;
      const role = h.d.role === 'tank' ? 1 : h.d.role === 'healer' ? 0.8 : 0.5;
      let v = W.miss * miss + W.urg * urg * (B.phase === 'crisis' ? 1.3 : 1) + W.role * role;
      if (missAmt < s.amount * 0.4) v *= Math.max(0, missAmt) / (s.amount * 0.4);   // 넘치는 힐
      if (s.tags.includes('큰') && missAmt < s.amount * 0.7 && urg < 0.6) v *= 0.4;   // 큰 힐은 많이 빠졌거나 급할 때
      if (dist(u, h) > s.range) v *= 0.9;
      if (!best || v > best.v) best = { h, v, miss, urg, role, claimed };
    }
    if (!best) return null;
    let v = best.v, why = `빠진 체력 ${best.miss.toFixed(2)} · 급함 ${best.urg.toFixed(2)} · 역할 ${best.role}`;
    if (best.claimed) why += ` · 예약된 힐 ${best.claimed} 뺌`;
    if ((u.mana - s.mana) / u.d.mana < G.style.board.manaReserve && best.urg < 0.6) { v *= 0.3; why += ` · 마나 아끼기 (${Math.round(G.style.board.manaReserve * 100)}% 남김)`; }
    return { label: `${s.n} → ${best.h.d.name}`, short: `✚ ${best.h.d.name}`, score: v, why, plan: { kind: 'skill', skill: a.skill, target: best.h } };
  },
  // 원거리 헌터: 근접 적이 가까우면 거리 벌리기 (12곳을 재 보고 제일 좋은 자리)
  '거리두기'(G, u) {
    const lim = G.style.w.kite, m = nearest(u, liveFoes(G), e => e.d.melee), d = m ? dist(m, u) : 99;
    if (d >= lim) return { label: '거리두기', score: 0, why: `근접 적 ${d > 50 ? '없음' : d.toFixed(1) + '칸'} (기준 ${lim}칸)` };
    let spot = bestSpot(G, u);
    if (u.spot && dist(u.spot, spot) < 1 && !warnOn(G, u.spot)) spot = u.spot;   // 비슷한 자리면 안 바꿈 (떨림 막기)
    u.spot = spot;
    return { label: '거리두기', short: '↩ 거리두기', score: 0.35 + 0.5 * (1 - d / lim), why: `${m.label} ${d.toFixed(1)}칸 → 자리 점수 ${spot.v.toFixed(2)}인 곳으로`, plan: { kind: 'move', spot } };
  },
  // 기본 공격: 표적 점수 = 위험 + 막타 + 가까움 + 집중 − 이미 죽을 적
  '공격'(G, u, a) {
    if (a.skill) return null;
    const rs = rateTargets(G, u);
    if (!rs.length) return null;
    let pick = rs[0], note = '';
    const cur = u.tgt && alive(u.tgt) ? rs.find(r => r.e === u.tgt) : null;
    if (cur && pick.e !== cur.e) {
      if (G.t - u.tgtSince < 1) { note = ` · ${pick.e.label}(${pick.v.toFixed(2)})가 낫지만 1초 유지`; pick = cur; }
      else if (pick.v < cur.v * 1.2) { note = ` · ${pick.e.label}(${pick.v.toFixed(2)})가 20% 안 넘음 → 유지`; pick = cur; }
    }
    const p = pick;
    return { label: `공격 → ${p.e.label}`, short: `⚔ ${p.e.label}`, score: Math.max(MIN_SCORE, p.v), why: `${p.v.toFixed(2)} = ${fmtT(p)}${note}`, plan: { kind: 'attack', target: p.e },
      alts: rs.slice(0, 4).map(r => ({ label: r.e.label, v: r.v })),
      commit: () => { if (u.tgt !== p.e) { if (u.tgt && alive(u.tgt)) G.stats.switches++; u.tgt = p.e; u.tgtSince = G.t; } } };
  },
  '모이기'(G, u) {
    const spot = formationSpot(G, u), d = dist(u, spot);
    return { label: '모이기', short: '◎ 모이기', score: 0.5, why: `대형 자리까지 ${d.toFixed(1)}칸`, plan: { kind: 'move', spot } };
  },
  '후퇴'(G, u) {
    const spot = formationSpot(G, u);
    return { label: '후퇴', short: '⇦ 후퇴', score: 0.6, why: `${G.board.why} → 뒤로 물러남`, plan: { kind: 'move', spot } };
  },
};
