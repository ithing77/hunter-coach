// 진행: 실시간 루프, 작전 타임(멈춤), 작전 카드 끌어 올리기, 지도 클릭 이동, 알아서 탐험

const $ = id => document.getElementById(id);
let G = null, speed = 1, paused = false, last = 0, acc = 0, pauseInfo = null;

function start() {
  G = newGame(MAP.seed);
  speed = 1; paused = false; pauseInfo = null; acc = 0;
  $('endScreen').style.display = 'none';
  buildHeroCards(); buildHand(); setCard('defend', true);
  $('autoBtn').classList.remove('on');
}

// ---------- 카드 ----------
function cardHTML(c, big) {
  return `<div class="tc ${big ? 'big' : ''}" data-id="${c.id}" style="--cc:${c.color}">
    <div class="tc-top"><span class="tc-ic">${c.icon}</span>${c.n}</div>
    <div class="tc-body">${c.lines.map(l => `<div>· ${l}</div>`).join('')}</div></div>`;
}
function buildHand() {
  $('hand').innerHTML = CARDS.map(c => cardHTML(c)).join('');
  for (const el of $('hand').querySelectorAll('.tc')) el.addEventListener('pointerdown', e => beginDrag(e, el));
}
function setCard(id, quiet) {
  G.card = id; G.form = null; G.focusTarget = null;
  const c = CARDS.find(x => x.id === id);
  $('slot').innerHTML = cardHTML(c, true);
  for (const el of $('hand').querySelectorAll('.tc')) el.classList.toggle('used', el.dataset.id === id);
  if (!quiet) toast(G, `작전 변경: ${c.n}`, 'card');
}
let drag = null;
function beginDrag(e, el) {
  e.preventDefault();
  const r = el.getBoundingClientRect();
  const ghost = el.cloneNode(true); ghost.classList.add('ghost');
  ghost.style.width = r.width + 'px'; document.body.appendChild(ghost);
  drag = { id: el.dataset.id, ghost, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
  moveGhost(e);
  addEventListener('pointermove', moveGhost);
  addEventListener('pointerup', endDrag, { once: true });
}
function moveGhost(e) {
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
  drag.ghost.style.left = (e.clientX - drag.ox) + 'px'; drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
  const s = $('slotBox').getBoundingClientRect();
  $('slotBox').classList.toggle('hot', e.clientX > s.left && e.clientX < s.right && e.clientY > s.top - 40 && e.clientY < s.bottom);
}
function endDrag(e) {
  removeEventListener('pointermove', moveGhost);
  const s = $('slotBox').getBoundingClientRect();
  const over = e.clientX > s.left && e.clientX < s.right && e.clientY > s.top - 40 && e.clientY < s.bottom;
  if (over || !drag.moved) setCard(drag.id);   // 끌어 올리거나, 그냥 눌러도 바뀜
  drag.ghost.remove(); drag = null; $('slotBox').classList.remove('hot');
}

// ---------- 헌터 카드 ----------
function buildHeroCards() {
  $('heroes').innerHTML = allHeroes(G).map(h => `<div class="hero" id="h-${h.id}"><canvas width="56" height="56" id="hp-pt-${h.id}"></canvas>
    <div><div class="hn">${h.d.name}</div><div class="bar"><i id="hpb-${h.id}"></i></div><div class="hs" id="hs-${h.id}"></div></div></div>`).join('');
  for (const h of allHeroes(G)) View.portrait($('hp-pt-' + h.id), h.d.art);
}
function renderHud() {
  for (const h of allHeroes(G)) {
    const r = h.hp / h.max;
    $('hpb-' + h.id).style.width = r * 100 + '%';
    $('hpb-' + h.id).style.background = r > 0.5 ? '#4cc36b' : r > 0.25 ? '#f0b429' : '#e5533d';
    $('hs-' + h.id).textContent = h.state === 'down' ? '쓰러짐' : `${Math.ceil(h.hp)} / ${h.max}`;
    $('h-' + h.id).classList.toggle('down', h.state === 'down');
  }
  const left = G.groups.filter(g => !g.done).length, found = G.groups.filter(g => g.discovered && !g.done).length;
  $('goal').textContent = `남은 적 무리 ${left} / ${G.groups.length} · 발견 ${found}`;
  $('state').textContent = G.combat ? '⚔ 전투 중' : G.anchor.mode === 'auto' ? '🧭 알아서 탐험 중' : G.anchor.mode === 'move' ? '🚶 이동 중' : '대기 중 — 지도를 눌러 이동';
  $('state').className = G.combat ? 'fight' : '';
  const html = G.toasts.slice().reverse().map(t => `<div class="${t.kind}">${t.text}</div>`).join('');
  if ($('log').dataset.h !== html) { $('log').innerHTML = html; $('log').dataset.h = html; }
}

// ---------- 작전 타임 ----------
function openPause(req) {
  pauseInfo = req;
  $('pause').style.display = '';
  $('pTitle').textContent = req.title;
  $('pLines').innerHTML = req.lines.map(l => `<div>${l}</div>`).join('');
  $('pHint').textContent = req.kind === 'discover' ? '적이 아직 우리를 못 봤어요. 첫 작전을 고르세요.' : req.kind === 'ambush' ? '준비할 틈이 없어요! 바로 작전을 고르세요.' : '상황이 바뀌었어요. 작전을 바꿀까요?';
  $('pause').className = 'pause ' + req.kind;
}
function closePause() { pauseInfo = null; $('pause').style.display = 'none'; }

// ---------- 루프 ----------
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  if (G && View.ready) {
    if (!pauseInfo && !paused && G.phase === 'play') {
      acc += dt * speed;
      while (acc >= STEP) {
        step(G, STEP); acc -= STEP;
        if (G.pauseReq) { openPause(G.pauseReq); G.pauseReq = null; acc = 0; break; }
        if (G.phase !== 'play') { showEnd(); break; }
      }
    }
    View.draw(G);
    renderHud();
  }
  requestAnimationFrame(loop);
}
function showEnd() {
  const won = G.phase === 'won';
  $('endTitle').textContent = won ? '🏆 지역 정리 완료!' : '💀 파티가 쓰러졌어요';
  $('endSub').textContent = `걸린 시간 ${Math.floor(G.t / 60)}분 ${Math.floor(G.t % 60)}초 · 처치 ${G.stats.kills}`;
  $('endScreen').style.display = 'grid';
}

// ---------- 입력 ----------
$('field').addEventListener('pointerdown', e => {
  if (!G || pauseInfo || e.button !== 0) return;
  const r = $('field').getBoundingClientRect(), p = View.toWorld(e.clientX - r.left, e.clientY - r.top);
  if (orderMove(G, p.x, p.y)) $('autoBtn').classList.remove('on');
});
$('autoBtn').onclick = () => { const on = toggleAuto(G); $('autoBtn').classList.toggle('on', on); };
$('pauseBtn').onclick = () => { paused = !paused; $('pauseBtn').textContent = paused ? '▶ 계속' : '⏸ 멈춤'; };
for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => { speed = +b.dataset.speed; for (const x of document.querySelectorAll('[data-speed]')) x.classList.toggle('on', x === b); };
$('critToggle').onchange = () => { PAUSE_ON.critical = $('critToggle').checked; };
$('goBtn').onclick = closePause;
$('againBtn').onclick = start;
addEventListener('keydown', e => {
  if (!G) return;
  if (/^[1-5]$/.test(e.key)) setCard(CARDS[+e.key - 1].id);
  if (e.key === 'Enter' && pauseInfo) closePause();
  if (e.key === ' ' && !pauseInfo) { e.preventDefault(); $('pauseBtn').click(); }
  if (e.key.toLowerCase() === 'e') $('autoBtn').click();
});
View.init($('field'), $('mini')).then(() => { start(); requestAnimationFrame(loop); });
