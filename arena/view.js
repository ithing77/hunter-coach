// 전투장 그리기: 바닥·예고 원·유닛(LPC)·말풍선·표적 선·숫자

const View = (() => {
  let cv, cx, art = {}, ready = false, S = 1, ox = 0, oy = 0;
  const FPS = { walk: 10, idle: 2, combat_idle: 2, hurt: 8 };
  const opt = { lines: true, bubbles: true, zoom: 1 };   // zoom = 캐릭터 크기 (작게 하면 판 위의 말처럼 내려다보는 느낌)

  async function init(canvas) {
    cv = canvas; cx = cv.getContext('2d');
    const kinds = [...new Set(Object.values(UNITS).map(u => u.art))];
    await Promise.all(kinds.map(async k => {
      const meta = await (await fetch(`art/showcase/${k}/showcase.json`)).json();
      art[k] = { meta, img: {} };
      const us = Object.values(UNITS).filter(u => u.art === k);
      const need = ['walk', 'idle', 'combat_idle', 'hurt', 'thrust', ...us.map(u => u.attack), ...us.flatMap(u => (u.skills || []).map(s => SKILLS[s].anim).filter(Boolean))];
      await Promise.all([...new Set(need)].filter(a => meta[a]).map(a => new Promise(r => { const i = new Image(); i.onload = r; i.onerror = r; i.src = `art/showcase/${k}/${a}.png`; art[k].img[a] = i; })));
    }));
    new ResizeObserver(resize).observe(cv); resize();
    ready = true;
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(320, Math.round(r.width)); cv.height = Math.max(200, Math.round(r.height));
    S = Math.min(cv.width / (ARENA.w * TILE), cv.height / (ARENA.h * TILE));
    ox = (cv.width - ARENA.w * TILE * S) / 2; oy = (cv.height - ARENA.h * TILE * S) / 2;
  }
  const P = (x, y) => ({ x: ox + x * TILE * S, y: oy + y * TILE * S });
  const toWorld = (sx, sy) => ({ x: (sx - ox) / (TILE * S), y: (sy - oy) / (TILE * S) });

  function draw(G, sel) {
    if (!ready) return;
    cx.imageSmoothingEnabled = false;
    cx.fillStyle = '#14160f'; cx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < ARENA.h; y++) for (let x = 0; x < ARENA.w; x++) {
      const p = P(x, y);
      cx.fillStyle = (x + y) % 2 ? '#7fae57' : '#78a852'; cx.fillRect(p.x, p.y, TILE * S + 1, TILE * S + 1);
    }
    cx.strokeStyle = '#3d5a2a'; cx.lineWidth = 3; const a = P(0, 0); cx.strokeRect(a.x, a.y, ARENA.w * TILE * S, ARENA.h * TILE * S);
    // 예고 원
    for (const w of G.warns) {
      const p = P(w.x, w.y), r = w.r * TILE * S, k = Math.min(1, w.T / w.warn);
      if (!w.done) {
        cx.fillStyle = 'rgba(229,60,40,.18)'; cx.beginPath(); cx.arc(p.x, p.y, r, 0, 7); cx.fill();
        cx.fillStyle = 'rgba(229,60,40,.35)'; cx.beginPath(); cx.arc(p.x, p.y, r * k, 0, 7); cx.fill();
        cx.strokeStyle = '#ff5a3a'; cx.lineWidth = 2; cx.beginPath(); cx.arc(p.x, p.y, r, 0, 7); cx.stroke();
      }
    }
    // 재집결 지점 (후퇴·재집결일 때)
    const B = G.board;
    if ((B.phase === 'retreat' || B.phase === 'regroup' || B.phase === 'gather') && B.regroup) {
      const p = P(B.regroup.x, B.regroup.y); cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.setLineDash([4, 4]); cx.lineWidth = 2;
      cx.beginPath(); cx.arc(p.x, p.y, 14 * S + 6, 0, 7); cx.stroke(); cx.setLineDash([]);
    }
    // 표적 선
    if (opt.lines) {
      for (const u of G.units) {
        if (!alive(u)) continue;
        const t = u.team === 'h' ? (u.plan && u.plan.target !== u ? u.plan.target : null) : u.target;
        if (!t || !alive(t)) continue;
        const isSel = sel && (u === sel || t === sel);
        if (!isSel && u.team === 'h' && t.team === 'h' && !(u.plan && u.plan.kind === 'skill')) continue;
        const p = P(u.x, u.y - 0.4), q = P(t.x, t.y - 0.4);
        cx.strokeStyle = u.team === 'h' ? (t.team === 'h' ? 'rgba(123,227,123,.8)' : 'rgba(127,212,255,.55)') : 'rgba(255,90,74,.45)';
        cx.lineWidth = isSel ? 2.5 : 1.2; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke();
      }
    }
    // 선택한 헌터가 가려는 자리
    if (sel && sel.plan && sel.plan.spot && alive(sel)) {
      const p = P(sel.plan.spot.x, sel.plan.spot.y);
      cx.strokeStyle = '#ffe27a'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(p.x - 6, p.y - 6); cx.lineTo(p.x + 6, p.y + 6); cx.moveTo(p.x + 6, p.y - 6); cx.lineTo(p.x - 6, p.y + 6); cx.stroke();
    }
    G.units.slice().sort((a, b) => a.y - b.y).forEach(u => drawUnit(G, u, u === sel));
    // 화살·마법
    for (const s of G.shots) {
      const p = P(s.x, s.y);
      if (s.kind === 'bolt') { cx.fillStyle = '#ffe9a0'; cx.beginPath(); cx.arc(p.x, p.y, 3 * S + 1, 0, 7); cx.fill(); continue; }
      cx.strokeStyle = s.kind === 'big' ? '#ffd23a' : '#3b2412'; cx.lineWidth = s.kind === 'big' ? 3 : 2;
      cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - Math.cos(s.a) * 12 * S, p.y - Math.sin(s.a) * 12 * S); cx.stroke();
    }
    // 고리·숫자
    for (const f of G.fx) {
      const u = f.t / f.life;
      if (f.kind === 'ring') { const p = P(f.x, f.y); cx.globalAlpha = 1 - u; cx.strokeStyle = f.color; cx.lineWidth = 3; cx.beginPath(); cx.arc(p.x, p.y, f.r * TILE * S * (0.6 + 0.4 * u), 0, 7); cx.stroke(); cx.globalAlpha = 1; }
    }
    cx.textAlign = 'center'; cx.font = `900 ${Math.round(13 * Math.max(0.8, S))}px sans-serif`; cx.lineWidth = 3;
    for (const f of G.fx) {
      if (f.kind !== 'num') continue;
      const p = P(f.x, f.y), u = f.t / f.life;
      cx.globalAlpha = 1 - u; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.strokeText(f.text, p.x, p.y - u * 20); cx.fillStyle = f.color; cx.fillText(f.text, p.x, p.y - u * 20); cx.globalAlpha = 1;
    }
    if (opt.bubbles) for (const u of G.units) if (u.team === 'h' && alive(u) && u.say) drawBubble(u, u === sel);
  }
  function drawUnit(G, u, isSel) {
    const A = art[u.d.art], p = P(u.x, u.y), sc = (u.d.scale || 1) * S * opt.zoom;
    let anim, row = u.face, frame, hold = false, prog = null;
    if (u.state === 'down' || u.state === 'dead') { anim = 'hurt'; hold = true; }
    else if (u.state === 'attack') { anim = u.d.attack; prog = u.atkT / u.d.atkTime; }
    else if (u.state === 'cast') { const s = SKILLS[u.cast.k]; anim = s.anim || u.d.attack; prog = u.cast.T / s.cast; }
    else if (u.state === 'slam') { anim = 'thrust'; const w = G.warns.find(w => w.by === u && !w.done); prog = w ? Math.min(0.5, w.T / w.warn * 0.5) + (w.T > w.warn - 0.2 ? 0.45 : 0) : 0.9; }
    else if (u.moving || u.walkT > 0) anim = 'walk';
    else anim = 'combat_idle';
    let m = A.meta[anim];
    if (!m || !A.img[anim]) { anim = 'idle'; m = A.meta.idle; prog = null; }
    if (anim === 'hurt') row = 0;
    if (prog !== null) frame = Math.min(m.cols - 1, Math.floor(prog * m.cols));
    else if (hold) frame = Math.min(m.cols - 1, Math.floor(u.animT * FPS.hurt));
    else if (anim === 'walk') frame = 1 + Math.floor(u.animT * FPS.walk) % (m.cols - 1);
    else frame = Math.floor(u.animT * (FPS[anim] || 4)) % m.cols;
    const Z = m.size, pad = (Z - 64) / 2;
    cx.fillStyle = 'rgba(0,0,0,.25)'; cx.beginPath(); cx.ellipse(p.x, p.y + 2 * sc, 11 * sc, 4 * sc, 0, 0, 7); cx.fill();
    if (isSel) { cx.strokeStyle = '#ffe27a'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(p.x, p.y + 2 * sc, 15 * sc, 6 * sc, 0, 0, 7); cx.stroke(); }
    else if (u.team === 'h' && alive(u)) { cx.strokeStyle = '#7fd4ff'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(p.x, p.y + 2 * sc, 13 * sc, 5 * sc, 0, 0, 7); cx.stroke(); }
    if (u.state === 'dead') cx.globalAlpha = Math.max(0, 1 - u.deadT / 3);
    if (u.state === 'down') cx.globalAlpha = 0.55;
    // 작게 그릴 땐 점을 섞어서 줄인다 (그냥 줄이면 얇은 선이 끊기고 걸을 때 지글거림)
    cx.imageSmoothingEnabled = sc < 0.95;
    cx.drawImage(A.img[anim], frame * Z, row * Z, Z, Z, p.x - (32 + pad) * sc, p.y - (57 + pad) * sc, Z * sc, Z * sc);
    cx.imageSmoothingEnabled = false;
    cx.globalAlpha = 1;
    if (u.blockT > 0 && alive(u)) { cx.fillStyle = 'rgba(156,199,255,.35)'; cx.strokeStyle = '#9cc7ff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(p.x, p.y - 20 * sc, 22 * sc, 0, 7); cx.fill(); cx.stroke(); }
    if (u.state === 'dead') return;
    const w = Math.max(20, 26 * sc), top = p.y - 52 * sc, r = u.hp / u.max;
    if (u.team === 'h' || u.hp < u.max) {
      cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(p.x - w / 2 - 1, top, w + 2, 5);
      cx.fillStyle = u.team === 'h' ? (r > 0.5 ? '#4cc36b' : r > 0.25 ? '#f0b429' : '#e5533d') : '#e5533d'; cx.fillRect(p.x - w / 2, top + 1, w * r, 3);
    }
    if (u.d.mana) { cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(p.x - w / 2 - 1, top + 5, w + 2, 4); cx.fillStyle = '#5aa0ff'; cx.fillRect(p.x - w / 2, top + 6, w * u.mana / u.d.mana, 2); }
    if (u.state === 'cast') { const s = SKILLS[u.cast.k], k = u.cast.T / s.cast; cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(p.x - w / 2 - 1, p.y + 6 * sc, w + 2, 5); cx.fillStyle = '#ffe27a'; cx.fillRect(p.x - w / 2, p.y + 7 * sc, w * k, 3); }
  }
  function drawBubble(u, isSel) {
    const p = P(u.x, u.y), sc = S * opt.zoom, text = u.say;
    const fade = isSel ? 1 : clamp(u.sayT / 0.4, 0.35, 1);
    cx.font = `700 ${Math.round(11 * Math.max(0.85, S))}px "Malgun Gothic", sans-serif`;
    const tw = cx.measureText(text).width + 10, h = 17, x = p.x - tw / 2, y = p.y - 72 * sc - h;
    cx.globalAlpha = fade;
    cx.fillStyle = isSel ? 'rgba(255,240,180,.97)' : 'rgba(255,255,255,.92)'; cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 1;
    cx.beginPath(); cx.roundRect(x, y, tw, h, 6); cx.fill(); cx.stroke();
    cx.beginPath(); cx.moveTo(p.x - 4, y + h); cx.lineTo(p.x, y + h + 5); cx.lineTo(p.x + 4, y + h); cx.fill();
    cx.fillStyle = '#2b2418'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(text, p.x, y + h / 2 + 1); cx.textBaseline = 'alphabetic';
    cx.globalAlpha = 1;
  }
  function pick(G, sx, sy) {
    const w = toWorld(sx, sy);
    let best = null, bd = 1.2;
    for (const u of G.units) { if (u.state === 'dead') continue; const d = hyp(u.x - w.x, u.y - 0.6 * (u.d.scale || 1) - w.y); if (d < bd * (u.d.scale || 1)) { bd = d / (u.d.scale || 1); best = u; } }
    return best;
  }
  function portrait(canvas, artId) {
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(art[artId].img.idle, 0, 128, 64, 64, -6, -8, canvas.width * 1.25, canvas.height * 1.25);
  }
  return { init, draw, pick, portrait, opt, get ready() { return ready; } };
})();
