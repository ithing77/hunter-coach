// 지도·유닛·안개·작은 지도 그리기

const View = (() => {
  let cv, cx, mini, mx, art = {}, cam = { x: 0, y: 0 }, ready = false, treeCache = null;
  const FPS = { walk: 10, idle: 2, combat_idle: 2, hurt: 8 };

  async function init(canvas, minimap) {
    cv = canvas; cx = cv.getContext('2d'); mini = minimap; mx = mini.getContext('2d');
    const kinds = [...new Set(Object.values(UNITS).map(u => u.art))];
    await Promise.all(kinds.map(async k => {
      const meta = await (await fetch(`art/showcase/${k}/showcase.json`)).json();
      art[k] = { meta, img: {} };
      const need = ['walk', 'idle', 'combat_idle', 'hurt', ...Object.values(UNITS).filter(u => u.art === k).map(u => u.attack)];
      await Promise.all([...new Set(need)].filter(a => meta[a]).map(a => new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = `art/showcase/${k}/${a}.png`; art[k].img[a] = i; })));
    }));
    new ResizeObserver(resize).observe(cv); resize();
    ready = true;
  }
  function resize() { const r = cv.getBoundingClientRect(); cv.width = Math.max(320, Math.round(r.width)); cv.height = Math.max(240, Math.round(r.height)); }
  const toScreen = (x, y) => ({ x: (x - cam.x) * TILE + cv.width / 2, y: (y - cam.y) * TILE + cv.height / 2 });
  const toWorld = (sx, sy) => ({ x: (sx - cv.width / 2) / TILE + cam.x, y: (sy - cv.height / 2) / TILE + cam.y });

  function draw(G) {
    if (!ready) return;
    const W = G.world;
    // 카메라는 파티를 부드럽게 따라간다
    cam.x += (G.anchor.x - cam.x) * 0.08; cam.y += (G.anchor.y - cam.y) * 0.08;
    if (!cam.init) { cam.x = G.anchor.x; cam.y = G.anchor.y; cam.init = true; }
    cx.imageSmoothingEnabled = false;
    cx.fillStyle = '#0b0c0a'; cx.fillRect(0, 0, cv.width, cv.height);
    const x0 = Math.max(0, Math.floor(cam.x - cv.width / 2 / TILE) - 1), x1 = Math.min(W.W - 1, Math.ceil(cam.x + cv.width / 2 / TILE) + 1);
    const y0 = Math.max(0, Math.floor(cam.y - cv.height / 2 / TILE) - 1), y1 = Math.min(W.H - 1, Math.ceil(cam.y + cv.height / 2 / TILE) + 2);
    // 땅
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const p = toScreen(x, y), t = W.tiles[y * W.W + x];
      cx.fillStyle = (x + y) % 2 ? '#7fae57' : '#78a852'; cx.fillRect(p.x, p.y, TILE + 1, TILE + 1);
      if (t === T_ROCK) { cx.fillStyle = '#8a8f86'; cx.beginPath(); cx.ellipse(p.x + 16, p.y + 18, 13, 10, 0, 0, 7); cx.fill(); cx.fillStyle = '#a9aea4'; cx.beginPath(); cx.ellipse(p.x + 12, p.y + 14, 7, 5, 0, 0, 7); cx.fill(); }
    }
    // 유닛 (보이는 적만)
    const list = G.units.filter(u => u.team === 'h' || (u.state === 'dead' ? u.deadT < 3 && isVisible(W, u.x, u.y) : isVisible(W, u.x, u.y)));
    // 나무·덤불은 유닛과 같이 y 순서로 그린다 (나무 뒤로 가려지게)
    const items = list.map(u => ({ y: u.y, f: () => drawUnit(G, u) }));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = W.tiles[y * W.W + x];
      if (t === T_TREE || t === T_BUSH) items.push({ y: y + 0.9, f: () => drawPlant(x, y, t) });
    }
    items.sort((a, b) => a.y - b.y).forEach(i => i.f());
    // 화살
    cx.strokeStyle = '#3b2412'; cx.lineWidth = 2;
    for (const s of G.shots) { const p = toScreen(s.x, s.y); cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - Math.cos(s.a) * 12, p.y - Math.sin(s.a) * 12); cx.stroke(); }
    // 목적지 표시
    const a = G.anchor;
    if (a.mode === 'move' && a.dest) { const p = toScreen(a.dest.x, a.dest.y); cx.strokeStyle = 'rgba(255,255,255,.8)'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(p.x, p.y, 10, 6, 0, 0, 7); cx.stroke(); }
    // 안개
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const f = W.fog[y * W.W + x];
      if (f === FOG_VISIBLE) continue;
      const p = toScreen(x, y);
      cx.fillStyle = f === FOG_UNSEEN ? '#0b0c0a' : 'rgba(10,12,9,.55)';
      cx.fillRect(Math.floor(p.x), Math.floor(p.y), TILE + 1, TILE + 1);
    }
    // 숫자
    cx.textAlign = 'center'; cx.font = '900 14px sans-serif'; cx.lineWidth = 3;
    for (const f of G.fx) {
      if (f.kind !== 'num') continue;
      const p = toScreen(f.x, f.y), u = f.t / f.life;
      cx.globalAlpha = 1 - u; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.strokeText(f.text, p.x, p.y - u * 20); cx.fillStyle = f.color; cx.fillText(f.text, p.x, p.y - u * 20); cx.globalAlpha = 1;
    }
    drawMini(G);
  }
  function drawPlant(x, y, t) {
    const p = toScreen(x, y);
    if (t === T_TREE) {
      cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(p.x + 16, p.y + 28, 15, 6, 0, 0, 7); cx.fill();
      cx.fillStyle = '#5a3d22'; cx.fillRect(p.x + 13, p.y + 14, 6, 16);
      cx.fillStyle = '#2f6a2a'; cx.beginPath(); cx.arc(p.x + 16, p.y + 4, 19, 0, 7); cx.fill();
      cx.fillStyle = '#3d8335'; cx.beginPath(); cx.arc(p.x + 11, p.y - 1, 11, 0, 7); cx.fill();
    } else {
      cx.fillStyle = '#4d8a3b'; cx.beginPath(); cx.arc(p.x + 10, p.y + 20, 10, 0, 7); cx.arc(p.x + 22, p.y + 18, 11, 0, 7); cx.fill();
      cx.fillStyle = '#5fa046'; cx.beginPath(); cx.arc(p.x + 16, p.y + 14, 8, 0, 7); cx.fill();
    }
  }
  function drawUnit(G, u) {
    const A = art[u.d.art], p = toScreen(u.x, u.y);
    let anim, row = u.face, frame, hold = false;
    if (u.state === 'down' || u.state === 'dead') { anim = 'hurt'; row = 0; hold = true; }
    else if (u.state === 'attack') anim = u.d.attack;
    else if (u.moving || u.walkT > 0) anim = 'walk';
    else anim = G.combat ? 'combat_idle' : 'idle';
    let m = A.meta[anim];
    if (!m || !A.img[anim]) { anim = 'idle'; m = A.meta.idle; }
    if (anim === 'hurt') row = 0;
    if (u.state === 'attack' && anim === u.d.attack) frame = Math.min(m.cols - 1, Math.floor(u.atkT / u.d.atkTime * m.cols));
    else if (hold) frame = Math.min(m.cols - 1, Math.floor(u.animT * FPS.hurt));
    else if (anim === 'walk') frame = 1 + Math.floor(u.animT * FPS.walk) % (m.cols - 1);
    else frame = Math.floor(u.animT * (FPS[anim] || 4)) % m.cols;
    const S = m.size, pad = (S - 64) / 2;
    cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(p.x, p.y + 2, 11, 4, 0, 0, 7); cx.fill();
    if (u.team === 'h') { cx.strokeStyle = '#7fd4ff'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(p.x, p.y + 2, 13, 5, 0, 0, 7); cx.stroke(); }
    if (u.state === 'dead') cx.globalAlpha = Math.max(0, 1 - u.deadT / 3);
    cx.drawImage(A.img[anim], frame * S, row * S, S, S, Math.round(p.x - 32 - pad), Math.round(p.y - 57 - pad), S, S);
    cx.globalAlpha = 1;
    if (u.state !== 'dead' && (u.team === 'h' || u.hp < u.max)) {
      const w = 26, r = u.hp / u.max;
      cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(p.x - w / 2 - 1, p.y - 52, w + 2, 5);
      cx.fillStyle = u.team === 'h' ? (r > 0.5 ? '#4cc36b' : r > 0.25 ? '#f0b429' : '#e5533d') : '#e5533d'; cx.fillRect(p.x - w / 2, p.y - 51, w * r, 3);
    }
  }
  function drawMini(G) {
    const W = G.world, s = mini.width / W.W;
    mx.fillStyle = '#0b0c0a'; mx.fillRect(0, 0, mini.width, mini.height);
    for (let y = 0; y < W.H; y++) for (let x = 0; x < W.W; x++) {
      const f = W.fog[y * W.W + x];
      if (f === FOG_UNSEEN) continue;
      const t = W.tiles[y * W.W + x];
      mx.fillStyle = t === T_TREE ? (f === FOG_VISIBLE ? '#2f6a2a' : '#1f3a1c') : (f === FOG_VISIBLE ? '#7fae57' : '#3f5a2c');
      mx.fillRect(x * s, y * s, Math.ceil(s), Math.ceil(s));
    }
    for (const u of G.units) {
      if (!alive(u)) continue;
      if (u.team === 'e' && !isVisible(W, u.x, u.y) && !u.group.discovered) continue;
      if (u.team === 'e' && !isVisible(W, u.x, u.y)) continue;
      mx.fillStyle = u.team === 'h' ? '#7fd4ff' : '#ff5a4a'; mx.fillRect(u.x * s - 2, u.y * s - 2, 4, 4);
    }
    // 화면 테두리
    mx.strokeStyle = 'rgba(255,255,255,.6)'; mx.lineWidth = 1;
    mx.strokeRect((cam.x - cv.width / 2 / TILE) * s, (cam.y - cv.height / 2 / TILE) * s, cv.width / TILE * s, cv.height / TILE * s);
  }
  function portrait(canvas, artId) {
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(art[artId].img.idle, 0, 128, 64, 64, -8, -10, 80, 80);
  }
  return { init, draw, toWorld, portrait, get ready() { return ready; } };
})();
