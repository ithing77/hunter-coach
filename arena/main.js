// 전투장 진행: 실시간 루프, 느리게·한 칸씩, 유닛 고르기, 생각 보기 창, 30판 시험

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let G = null, speed = 1, paused = false, last = 0, acc = 0, sel = null, panelT = 0, logN = -1;

function start() {
  G = newBattle($('scn').value, $('style').value, +$('seed').value || 1);
  sel = G.units.find(u => u.kind === 'cleric') || G.units[0];
  acc = 0; logN = -1; $('endBanner').style.display = 'none';
  buildHeroes(); renderPanels(true);
}
function setPaused(p) { paused = p; $('pauseBtn').textContent = p ? '▶' : '⏸'; $('pauseBtn').classList.toggle('on', p); }

// ---------- 헌터 칸 ----------
function buildHeroes() {
  $('heroes').innerHTML = G.units.filter(u => u.team === 'h').map(h => `<div class="hero" data-id="${h.id}"><canvas width="48" height="48" id="pt-${h.id}"></canvas>
    <div><div class="hn">${h.d.name} <span class="sub">${{ tank: '탱커', dealer: '딜러', archer: '궁수', healer: '힐러' }[h.d.role]}</span></div>
    <div class="bar"><i id="hpb-${h.id}"></i></div>${h.d.mana ? `<div class="bar" style="height:4px"><i id="mpb-${h.id}" style="background:#5aa0ff"></i></div>` : ''}
    <div class="hs" id="hs-${h.id}"></div></div></div>`).join('');
  for (const el of $('heroes').querySelectorAll('.hero')) el.onclick = () => { sel = G.units[+el.dataset.id]; renderPanels(true); };
  if (View.ready) for (const h of G.units.filter(u => u.team === 'h')) View.portrait($('pt-' + h.id), h.d.art);
}
function updateHeroes() {
  for (const h of G.units.filter(u => u.team === 'h')) {
    const r = h.hp / h.max;
    $('hpb-' + h.id).style.width = r * 100 + '%';
    $('hpb-' + h.id).style.background = r > 0.5 ? '#4cc36b' : r > 0.25 ? '#f0b429' : '#e5533d';
    if (h.d.mana) $('mpb-' + h.id).style.width = h.mana / h.d.mana * 100 + '%';
    $('hs-' + h.id).textContent = alive(h) ? (h.plan ? h.plan.label : '대기') : '쓰러짐';
    const el = document.querySelector(`.hero[data-id="${h.id}"]`);
    el.classList.toggle('down', !alive(h)); el.classList.toggle('sel', h === sel);
  }
}

// ---------- 생각 보기 ----------
const pct = v => Math.round(v * 100) + '%';
function renderThink() {
  const u = sel;
  if (!u) { $('thinkBox').innerHTML = '<h3>🧠 생각 보기</h3><div class="sub">전투장에서 유닛을 누르세요</div>'; return; }
  if (u.team === 'e') return renderEnemy(u);
  const th = u.thought;
  const cds = (u.d.skills || []).map(k => { const n = notReady(u, k); return `${SKILLS[k].n} ${n ? `<span class="sub">${n}</span>` : '<span style="color:var(--good)">준비</span>'}`; }).join(' · ');
  let h = `<h3>🧠 생각 보기 <span class="r">${th ? `${th.t.toFixed(2)}초에 생각함` : ''}</span></h3>
    <div class="who">${u.d.name} <span class="sub">체력 ${Math.ceil(u.hp)}/${u.max}${u.d.mana ? ` · 마나 ${Math.floor(u.mana)}/${u.d.mana}` : ''}${!alive(u) ? ' · 쓰러짐' : ''}</span></div>
    <div class="sub">${cds}</div>`;
  if (!th || !alive(u)) { $('thinkBox').innerHTML = h; return; }
  h += `<div class="sub" style="margin-top:4px">국면 <b style="color:var(--ink)">${PHASE_NAMES[th.phase]}</b> → 우선순위 ${th.prio.join(' › ')}</div>`;
  th.prio.forEach((tag, i) => {
    const tier = th.tiers[i];
    if (!tier) { h += `<div class="tier skip"><span class="tname">${i + 1}. ${tag}</span> <span class="sub">— 위에서 정해져서 안 봄</span></div>`; return; }
    h += `<div class="tier ${tier.picked ? 'picked' : ''}"><span class="tname">${i + 1}. ${tag}</span>${tier.cands.length ? '' : ' <span class="sub">— 이 줄에 쓸 행동 없음</span>'}`;
    tier.cands.forEach((c, j) => {
      const win = tier.picked && j === 0;
      h += `<div class="cand"><span class="l ${win ? 'win' : ''}">${win ? '✔ ' : ''}${esc(c.label)}</span><span class="b"><i style="width:${clamp(c.score, 0, 1) * 100}%;${c.score >= MIN_SCORE ? '' : 'background:#666'}"></i><span class="min" style="left:${MIN_SCORE * 100}%"></span></span><span class="s">${c.score.toFixed(2)}</span></div>
        <div class="why">${esc(c.why || '')}</div>`;
      if (win && c.alts) h += `<div class="why">표적 후보: ${c.alts.map(a => `${a.label} ${a.v.toFixed(2)}`).join(' · ')}</div>`;
    });
    h += `</div>`;
  });
  h += `<div class="pick">결정: <b>${esc(th.pick.label)}</b><div class="why" style="margin:2px 0 0">${esc(th.pick.why || '')}</div></div>
    <div class="sub" style="margin-top:6px">막대의 흰 줄 = 기준 ${MIN_SCORE}. 위 줄부터 보고, 기준을 넘는 첫 줄에서 제일 높은 행동을 고릅니다.</div>`;
  $('thinkBox').innerHTML = h;
}
function renderEnemy(u) {
  const hs = G.units.filter(x => x.team === 'h');
  const rows = hs.map(h => ({ h, raw: u.threat.get(h.id) || 0, v: alive(h) ? threatValue(u, h) : 0 })).sort((a, b) => b.v - a.v);
  const mx = Math.max(1, ...rows.map(r => r.v));
  let h = `<h3>👹 적 머리 보기</h3><div class="who">${u.label} <span class="sub">체력 ${Math.ceil(u.hp)}/${u.max}${!alive(u) ? ' · 죽음' : ''}</span></div>
    <div style="margin-top:4px">표적: <b>${u.target ? u.target.d.name : '없음'}</b> <span class="sub">${esc(u.why || '')}</span></div>
    <div class="sub" style="margin:6px 0 2px">위협표 (누구에게 화가 났나)${u.d.backMul ? ` — 궁수·힐러는 ×${u.d.backMul}로 봄` : ''}</div>`;
  for (const r of rows) h += `<div class="thr"><span>${r.h.d.name}</span><span class="b"><i style="width:${r.v / mx * 100}%"></i></span><span class="sub" style="text-align:right">${Math.round(r.v)}</span></div>`;
  h += `<div class="sub" style="margin-top:6px">위협은 맞은 피해(기사는 ×4) · 받은 힐의 절반 · 가까이 있음으로 쌓이고, 도발하면 최고값 ×1.1이 됩니다. 15% 이상 차이 나야 표적을 바꿉니다.</div>`;
  if (u.d.skills && u.d.skills.includes('slam')) h += `<div class="sub">내려찍기 ${notReady(u, 'slam') || '준비'}</div>`;
  $('thinkBox').innerHTML = h;
}
function renderBoard() {
  const B = G.board, S = G.style;
  const claims = [...B.healClaims.entries()].map(([id, c]) => `${G.units[id].d.name} +${c.amt}`).join(', ') || '없음';
  const pend = [...B.pending.entries()].filter(([, v]) => v > 0).map(([id, v]) => `${G.units[id].label} ${Math.round(v)}`).join(', ') || '없음';
  $('boardBox').innerHTML = `<h3>📋 공유 메모판 <span class="r">성향: ${S.n}</span></h3><div class="kv">
    <div>국면</div><div><b>${PHASE_NAMES[B.phase]}</b> <span class="sub">${esc(B.why)} · ${B.phaseT.toFixed(1)}초째</span></div>
    <div>집중 표적</div><div>${B.focus && alive(B.focus) ? `<b>${B.focus.label}</b> <span class="sub">${esc(B.focusWhy)}</span>` : '없음'}</div>
    <div>기사가 잡은 적</div><div>${B.tankHeld.length ? B.tankHeld.map(e => e.label).join(', ') : '없음'}</div>
    <div>뒷줄 위협</div><div>${B.backThreat.length ? `<span style="color:var(--bad)">${B.backThreat.map(e => `${e.label}→${e.target.d.name}`).join(', ')}</span>` : '없음'}</div>
    <div>힐 예약</div><div>${claims}</div>
    <div>피해 예약</div><div>${pend}</div>
  </div>`;
}
function renderLog(force) {
  const only = $('logSel').checked && sel;
  const list = G.log.filter(l => !only || l.id === sel.id || l.id === -1);
  if (!force && list.length === logN) return;
  logN = list.length;
  $('log').innerHTML = list.slice(-150).reverse().map(l => `<div class="row" data-id="${l.id}"><span class="t">${l.t.toFixed(1)}초</span>${l.phase ? `<span class="ph">${esc(l.text)}</span>` : l.bad ? `<span class="bad">${l.name} ${esc(l.text)}</span>` : `<b>${l.name}</b> ${esc(l.text)}`}${l.why ? `<div class="w">${esc(l.why)}</div>` : ''}</div>`).join('');
  for (const el of $('log').querySelectorAll('.row')) el.onclick = () => { const id = +el.dataset.id; if (id >= 0) { sel = G.units[id]; renderPanels(true); } };
}
function renderPanels(force) { renderThink(); renderBoard(); renderLog(force); updateHeroes(); }

// ---------- 루프 ----------
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused && G.phase === 'play') {
    acc += dt * speed;
    while (acc >= STEP) { acc -= STEP; if (advance()) break; }
  }
  if (G.phase !== 'play' && $('endBanner').style.display === 'none') showEnd();
  View.draw(G, sel);
  $('clock').textContent = `${G.t.toFixed(1)}초`;
  $('phase').textContent = PHASE_NAMES[G.board.phase];
  $('phase').style.background = { crisis: '#7a2a20', retreat: '#6b5a20', regroup: '#2a4a6b', gather: '#3a3d33', engage: '#2f4d2a' }[G.board.phase];
  panelT -= dt;
  if (panelT <= 0 || paused) { panelT = 0.2; renderPanels(false); }
  requestAnimationFrame(tick);
}
// 한 칸 진행. "결정 바뀌면 멈춤"이 켜져 있으면 고른 헌터의 결정이 바뀌는 순간 멈춘다.
function advance() {
  const before = sel && sel.plan ? sel.plan.label : null;
  step(G, STEP);
  if ($('autoStop').checked && sel && sel.team === 'h' && alive(sel) && sel.plan && sel.plan.label !== before && before !== null) { setPaused(true); acc = 0; renderPanels(true); return true; }
  return false;
}
function showEnd() {
  const s = summarize(G), t = { won: '🏆 승리', lost: '💀 전멸', timeout: '⌛ 시간 끝' }[G.phase];
  $('endBanner').innerHTML = `${t} — ${s.time.toFixed(0)}초<div class="sub">쓰러짐 ${s.deaths} · 탱커가 맞음 ${pct(s.tankPct)} · 뒷줄 받은 피해 ${Math.round(s.backDmg)}${s.slamDodge !== null ? ` · 내려찍기 회피 ${pct(s.slamDodge)}` : ''} · 넘친 힐 ${pct(s.overhealPct)}</div>`;
  $('endBanner').style.display = 'block';
  renderPanels(true);
}

// ---------- 30판 시험 ----------
const METRICS = [
  ['win', '승률', v => pct(v), true], ['time', '시간', v => v.toFixed(0) + '초'], ['deaths', '쓰러짐', v => v.toFixed(2), false],
  ['tankPct', '탱커가 맞음', v => pct(v), true], ['backDmg', '뒷줄 피해', v => Math.round(v), false], ['slamDodge', '찍기 회피', v => v === null ? '-' : pct(v), true],
  ['switchPerMin', '표적 바꿈/분', v => v.toFixed(1)], ['overhealPct', '넘친 힐', v => pct(v), false], ['overkillPct', '넘친 공격', v => pct(v), false], ['flipPerMin', '걸음 떨림/분', v => v.toFixed(1), false],
];
function batchUI(rows, running) {
  let h = `<h2>📊 30판 시험</h2><div class="sub">매 판 시작 자리·반응 속도·피해량이 조금씩 달라요 (판 번호 1000~1029). 같은 판 번호면 같은 결과가 나와요.</div>`;
  if (rows.length) {
    h += `<table><tr><th>상황</th><th>성향</th>${METRICS.map(m => `<th>${m[1]}</th>`).join('')}</tr>`;
    for (const r of rows) h += `<tr><td>${SCENARIOS[r.scn].n}</td><td>${STYLES[r.style].n}</td>${METRICS.map(m => `<td>${m[2](r.a[m[0]])}</td>`).join('')}</tr>`;
    h += `</table>`;
  }
  h += running ? `<div style="margin-top:10px">${running}</div>` : `<div class="row-btns"><button id="bNow">지금 상황·성향만</button><button id="bAll">전부 (3상황 × 4성향)</button><button class="ghost" id="bClose">닫기</button></div>
    <div class="sub" style="margin-top:8px">탱커가 맞음 = 근접 적이 기사를 노린 시간 비율 · 뒷줄 피해 = 궁수+성직자가 받은 피해 · 걸음 떨림 = 같은 결정 안에서 0.4초 안에 뒤돌아선 횟수 · "비교용: 생각 없음"은 피하기·스킬 없이 가까운 적만 치는 머리</div>`;
  $('batchBox').innerHTML = h;
  if (!running) { $('bNow').onclick = () => runBatch([[$('scn').value, $('style').value]]); $('bAll').onclick = () => runBatch(Object.keys(SCENARIOS).flatMap(s => Object.keys(STYLES).map(t => [s, t]))); $('bClose').onclick = () => { $('batch').style.display = 'none'; }; }
}
function runBatch(jobs) {
  const out = [], N = 30;
  let j = 0, k = 0, rows = [];
  const work = () => {
    const t0 = performance.now();
    while (j < jobs.length && performance.now() - t0 < 40) {
      rows.push(runOne(jobs[j][0], jobs[j][1], 1000 + k));
      if (++k >= N) { out.push({ scn: jobs[j][0], style: jobs[j][1], a: aggregate(rows) }); rows = []; k = 0; j++; }
    }
    batchUI(out, j < jobs.length ? `돌리는 중… ${j + 1}/${jobs.length} (${k}/${N}판)` : '');
    if (j < jobs.length) setTimeout(work, 0);
  };
  work();
}

// ---------- 시작 ----------
$('scn').innerHTML = Object.entries(SCENARIOS).map(([k, s]) => `<option value="${k}">${s.n}</option>`).join('');
$('style').innerHTML = Object.entries(STYLES).map(([k, s]) => `<option value="${k}" title="${s.desc}">${s.n}</option>`).join('');
$('scn').onchange = $('style').onchange = $('seed').onchange = start;
$('resetBtn').onclick = start;
$('diceBtn').onclick = () => { $('seed').value = Math.floor(Math.random() * 9000) + 1; start(); };
$('pauseBtn').onclick = () => setPaused(!paused);
$('stepBtn').onclick = () => { setPaused(true); for (let i = 0; i < 3; i++) step(G, STEP); renderPanels(true); };
for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => { speed = +b.dataset.speed; document.querySelectorAll('[data-speed]').forEach(x => x.classList.toggle('on', x === b)); };
$('batchBtn').onclick = () => { $('batch').style.display = 'grid'; batchUI([], ''); };
$('logSel').onchange = () => renderLog(true);
$('field').addEventListener('click', e => { const r = $('field').getBoundingClientRect(); const u = View.pick(G, e.clientX - r.left, e.clientY - r.top); if (u) { sel = u; renderPanels(true); } });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space') { e.preventDefault(); setPaused(!paused); }
  else if (e.key === '.') $('stepBtn').click();
  else if (e.key === 'r' || e.key === 'R') start();
  else if (e.key >= '1' && e.key <= '4') { const h = G.units.filter(u => u.team === 'h')[+e.key - 1]; if (h) { sel = h; renderPanels(true); } }
});
start();
View.init($('field')).then(() => { buildHeroes(); last = performance.now(); requestAnimationFrame(tick); });
