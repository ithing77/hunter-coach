// 사냥 진행: 시뮬레이션 돌리기, 명령 창, 헌터 카드·몬스터 체력·기록 같은 화면 글자.

const $ = id => document.getElementById(id);
let S = null, speed = 1, paused = false, last = 0, acc = 0;
let win = null;   // 명령 창: { req, left, sel, cmds }

function start() {
  S = createHunt(Math.floor(Math.random() * 1e9));
  speed = 1; paused = false; win = null; acc = 0;
  $('startScreen').style.display = 'none';
  $('endScreen').style.display = 'none';
  buildCards();
  setSpeed(1);
}

// ---------- 헌터 카드 ----------
function buildCards() {
  $('cards').innerHTML = S.hunters.map(h => `
    <div class="hc" id="hc-${h.id}" data-id="${h.id}">
      <canvas width="56" height="56" id="pt-${h.id}"></canvas>
      <div class="hc-info">
        <div class="hc-name"><b>${h.id}</b> ${h.d.name} · ${h.d.weapon}</div>
        <div class="bar"><i class="hp" id="hp-${h.id}"></i></div>
        <div class="bar thin"><i class="st" id="st-${h.id}"></i></div>
        <div class="hc-tag" id="tag-${h.id}"></div>
      </div>
    </div>`).join('');
  for (const h of S.hunters) {
    View.portrait($('pt-' + h.id), h.d.art);
    $('hc-' + h.id).onclick = () => pickHunter(h.id);
  }
}
function renderHud() {
  const m = S.mon;
  $('monName').textContent = MONSTER.name;
  const r = m.hp / m.max;
  $('monHp').style.width = (r * 100) + '%';
  $('monHp').style.background = r > 0.5 ? '#e0533d' : r > 0.2 ? '#f08a24' : '#f5c518';
  $('monTag').textContent = m.state === 'dead' ? '토벌!' : m.state === 'stun' ? '눈이 멂' : m.enraged ? '분노!' : r < 0.2 ? '절뚝거림' : '';
  $('monTag').className = 'tag ' + (m.enraged && m.state !== 'dead' ? 'rage' : '');
  const t = Math.floor(S.t), lim = RULES.timeLimit - t;
  $('clock').textContent = `⏱ ${String(Math.floor(lim / 60)).padStart(2, '0')}:${String(lim % 60).padStart(2, '0')}`;
  $('faints').textContent = `쓰러짐 ${S.faints}/${RULES.faintsToFail}`;
  $('cp').innerHTML = Array.from({ length: CP.max }, (_, i) => `<span class="${i < cpLeft() ? 'on' : ''}"></span>`).join('') + `<small>CP ${cpLeft()}/${CP.max}</small>`;
  $('cpbar').style.width = (S.cp >= CP.max ? 100 : S.cpT / CP.regen * 100) + '%';
  $('buff').textContent = S.buffT > 0 ? `♪ 응원가 ${Math.ceil(S.buffT)}초` : '';
  for (const h of S.hunters) {
    $('hp-' + h.id).style.width = (h.hp / h.max * 100) + '%';
    $('hp-' + h.id).style.background = h.hp / h.max > 0.5 ? '#4cc36b' : h.hp / h.max > 0.25 ? '#f0b429' : '#e5533d';
    $('st-' + h.id).style.width = h.st + '%';
    const card = $('hc-' + h.id);
    const danger = win && win.req && S.mon.zone && inZone(S.mon.zone, h.x, h.y) && h.state !== 'faint';
    card.classList.toggle('danger', !!danger);
    card.classList.toggle('sel', !!(win && win.sel === h.id));
    card.classList.toggle('faint', h.state === 'faint');
    let tag = '';
    if (h.state === 'faint') tag = `쓰러짐 · ${Math.ceil(h.reviveT)}초 뒤 복귀`;
    else if (win && win.cmds[h.id]) { const c = COMMANDS.find(x => x.id === win.cmds[h.id]); tag = `${c.icon} ${c.n}`; }
    else if (h.react) tag = { evade: '↷ 회피 대기', guard: '▣ 가드 대기', counter: '⚔ 반격 대기' }[h.react];
    else if (h.counterReady) tag = '⚔ 반격하러 감';
    else if (danger) tag = '⚠ 위험!';
    else tag = { stun: '굳음', down: '넘어짐', evade: '회피 중', guarding: '가드 중', drink: '물약', cast: '마법', attack: '공격', counter: '반격!' }[h.state] || '';
    $('tag-' + h.id).textContent = tag;
  }
  const lg = $('log');
  const html = S.log.slice(0, 14).map(l => `<div class="${l.big ? 'big' : ''}"><small>${fmt(l.t)}</small> ${l.text}</div>`).join('');
  if (lg.dataset.h !== html) { lg.innerHTML = html; lg.dataset.h = html; }
}
const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// ---------- 명령 창 ----------
function openWindow(req) {
  win = { req, left: RULES.windowSeconds, sel: null, cmds: {} };
  $('win').style.display = '';
  $('side').scrollTop = 0;
  $('winWarn').textContent = req ? `⚠ ${req.warn}` : '작전 타임';
  $('winHelp').textContent = req ? '빨간 곳에 있는 헌터를 확인하고, 카드를 눌러 명령을 고르세요' : '회복·응원가처럼 지금 필요한 명령을 고르세요';
  const inDanger = S.hunters.filter(h => h.state !== 'faint' && req && inZone(S.mon.zone, h.x, h.y));
  pickHunter((inDanger[0] || S.hunters.find(h => h.state !== 'faint') || S.hunters[0]).id);
}
function cpLeft() {
  if (!win) return S.cp;
  return S.cp - Object.values(win.cmds).reduce((a, id) => a + COMMANDS.find(c => c.id === id).cost, 0);
}
function pickHunter(id) {
  if (!win) return;
  win.sel = id;
  const h = S.hunters.find(x => x.id === id);
  $('winWho').textContent = `${h.id} ${h.d.name} (${h.d.weapon})에게:`;
  $('cmdBtns').innerHTML = COMMANDS.map((c, i) => {
    const ok = commandOK(S, id, c.id), chosen = win.cmds[id] === c.id;
    const afford = chosen || cpLeft() - (win.cmds[id] ? COMMANDS.find(x => x.id === win.cmds[id]).cost : 0) >= c.cost;
    if (!ok) return '';
    return `<button class="cmd ${chosen ? 'on' : ''} ${afford ? '' : 'poor'}" data-c="${c.id}" title="${c.d}"><span class="k">${'QWERTY'[i]}</span><b>${c.icon} ${c.n}</b><small>CP ${c.cost}</small></button>`;
  }).join('');
  for (const b of $('cmdBtns').querySelectorAll('.cmd')) b.onclick = () => pickCommand(b.dataset.c);
  for (const b of $('cmdBtns').querySelectorAll('.cmd')) b.onmouseenter = () => { $('cmdDesc').textContent = COMMANDS.find(c => c.id === b.dataset.c).d; };
  const cur = win.cmds[id] && COMMANDS.find(c => c.id === win.cmds[id]);
  $('cmdDesc').textContent = cur ? `${cur.n}: ${cur.d}` : '명령에 마우스를 올리면 설명이 나와요';
  renderHud();
}
function pickCommand(cid) {
  if (!win || !win.sel) return;
  const prev = win.cmds[win.sel];
  if (prev === cid) delete win.cmds[win.sel];
  else {
    const c = COMMANDS.find(x => x.id === cid);
    const free = cpLeft() + (prev ? COMMANDS.find(x => x.id === prev).cost : 0);
    if (c.cost > free) { flashCp(); return; }
    win.cmds[win.sel] = cid;
    // 다음 위험한 헌터로 넘어가기
    const next = S.hunters.find(h => h.id !== win.sel && !win.cmds[h.id] && h.state !== 'faint' && win.req && inZone(S.mon.zone, h.x, h.y));
    if (next) return pickHunter(next.id);
  }
  pickHunter(win.sel);
}
function flashCp() { const e = $('cp'); e.classList.remove('shake'); void e.offsetWidth; e.classList.add('shake'); }
function closeWindow() {
  if (!win) return;
  applyCommands(S, win.cmds);
  win = null;
  $('win').style.display = 'none';
}

// ---------- 끝 ----------
function endScreen() {
  const ok = S.phase === 'won';
  const total = Object.values(S.stats.dmg).reduce((a, b) => a + b, 0) || 1;
  const mvp = S.hunters.slice().sort((a, b) => S.stats.dmg[b.id] - S.stats.dmg[a.id])[0];
  $('endTitle').textContent = ok ? '🏆 토벌 성공!' : '💀 사냥 실패';
  $('endSub').textContent = ok ? `걸린 시간 ${fmt(S.t)} · 쓰러짐 ${S.faints}번` : S.endWhy;
  $('endBody').innerHTML = `
    <table>${S.hunters.map(h => `<tr><td><b>${h.id}</b> ${h.d.name} · ${h.d.weapon}</td><td class="r">${S.stats.dmg[h.id]}</td><td><div class="bar"><i style="width:${S.stats.dmg[h.id] / total * 100}%;background:#e0533d"></i></div></td><td>${h === mvp && ok ? '⭐ MVP' : ''}</td></tr>`).join('')}</table>
    <p>반격 성공 ${S.stats.counters}번 · 회피 ${S.stats.evades}번</p>
    ${ok ? `<div class="rew"><b>얻은 소재</b><br>${MONSTER.rewards.join(' · ')}</div><p class="muted">(데모라 소재는 저장되지 않아요. 다음 단계에서 대장간과 연결돼요)</p>` : ''}`;
  $('endScreen').style.display = 'grid';
}

// ---------- 루프 ----------
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  if (S) {
    if (win) {
      win.left -= dt;
      $('winBar').style.width = Math.max(0, win.left / RULES.windowSeconds * 100) + '%';
      $('winLeft').textContent = `${Math.ceil(Math.max(0, win.left))}초`;
      if (win.left <= 0) closeWindow();
    } else if (!paused && S.phase === 'hunt') {
      acc += dt * speed;
      while (acc >= STEP && S.phase === 'hunt') {
        stepHunt(S, STEP); acc -= STEP;
        if (S.windowReq) { const r = S.windowReq; S.windowReq = null; openWindow(r); acc = 0; break; }
      }
      if (S.phase !== 'hunt') setTimeout(endScreen, 1800);
    }
    View.draw(S, !!win);
    renderHud();
  }
  requestAnimationFrame(loop);
}
function setSpeed(v) { speed = v; for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('on', +b.dataset.speed === v); }
function togglePause() { paused = !paused; $('pauseBtn').textContent = paused ? '▶ 계속' : '❚❚ 멈춤'; $('pausedMsg').style.display = paused ? '' : 'none'; }

for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => setSpeed(+b.dataset.speed);
$('pauseBtn').onclick = togglePause;
$('orderBtn').onclick = () => { if (S && !win && S.phase === 'hunt') openWindow(null); };
$('okBtn').onclick = closeWindow;
$('goBtn').onclick = start;
$('againBtn').onclick = start;
addEventListener('keydown', e => {
  if (!S) return;
  if (win) {
    if (/^[1-4]$/.test(e.key)) pickHunter('ABCD'[+e.key - 1]);
    const i = 'qwerty'.indexOf(e.key.toLowerCase());
    if (i >= 0) { const list = COMMANDS.filter(c => commandOK(S, win.sel, c.id)); const c = COMMANDS[i]; if (list.includes(c)) pickCommand(c.id); }
    if (e.key === 'Enter') closeWindow();
  } else {
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    if (e.key.toLowerCase() === 'c') $('orderBtn').click();
  }
});
View.init($('field')).then(() => { $('goBtn').disabled = false; $('goBtn').textContent = '출발!'; requestAnimationFrame(loop); });
