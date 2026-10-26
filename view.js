// 경기장 그리기: 풀밭, 몬스터(코드로 그림), 헌터(LPC 그림), 공격 범위, 효과.

const View = (() => {
  const U = 24;   // 1칸 = 24픽셀
  let cv, cx, art = {}, meta = null, deco = [], shake = 0;
  const FPS = { walk: 10, run: 12, idle: 2, combat: 2, jump: 10, hurt: 10 };

  async function init(canvas) {
    cv = canvas; cx = cv.getContext('2d');
    cv.width = ARENA.w * U; cv.height = ARENA.h * U;
    meta = await (await fetch('art/hunters/hunters.json')).json();
    const jobs = [];
    for (const h of HUNTERS) {
      art[h.art] = {};
      for (const a of Object.keys(meta[h.art].anims)) {
        const img = new Image(); img.src = `art/hunters/${h.art}/${a}.png`;
        art[h.art][a] = img; jobs.push(img.decode().catch(() => {}));
      }
    }
    await Promise.all(jobs);
    const R = mulberry(42);
    for (let i = 0; i < 70; i++) deco.push({ x: R() * ARENA.w, y: R() * ARENA.h, k: R() < 0.12 ? 'rock' : R() < 0.5 ? 'flower' : 'tuft', s: 0.6 + R() * 0.8, c: R() });
  }
  const px = v => v * U;

  function draw(S, win) {
    cx.save();
    cx.imageSmoothingEnabled = false;
    const sh = S.fx.find(f => f.kind === 'shake');
    if (sh) cx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    ground();
    drawZone(S, win);
    // 그림자·몸 순서: y 가 작은 것부터
    const m = S.mon, P = monParts(m);
    const items = S.hunters.map(h => ({ y: h.y, f: () => drawHunter(h, S) }));
    items.push({ y: m.y + (m.z > 0.3 ? 99 : 0), f: () => drawMonster(m, P, S) });
    items.sort((a, b) => a.y - b.y).forEach(i => i.f());
    drawShots(S);
    drawFx(S);
    cx.restore();
    const fl = S.fx.find(f => f.kind === 'flash');
    if (fl) { cx.fillStyle = `rgba(255,255,255,${1 - fl.t / fl.life})`; cx.fillRect(0, 0, cv.width, cv.height); }
  }

  function ground() {
    cx.fillStyle = '#7fae57'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.fillStyle = '#76a451';
    for (let y = 0; y < ARENA.h; y += 2) for (let x = (y / 2) % 2 * 2; x < ARENA.w; x += 4) cx.fillRect(px(x), px(y), px(2), px(2));
    for (const d of deco) {
      const X = px(d.x), Y = px(d.y);
      if (d.k === 'rock') { cx.fillStyle = '#8a8f86'; cx.beginPath(); cx.ellipse(X, Y, 14 * d.s, 10 * d.s, 0, 0, 7); cx.fill(); cx.fillStyle = '#a7aca2'; cx.beginPath(); cx.ellipse(X - 3, Y - 3, 8 * d.s, 5 * d.s, 0, 0, 7); cx.fill(); }
      else if (d.k === 'flower') { cx.fillStyle = d.c < 0.5 ? '#f3e37c' : '#f7f2f0'; cx.fillRect(X, Y, 3, 3); cx.fillRect(X + 6, Y + 4, 3, 3); }
      else { cx.fillStyle = '#5f8f3e'; cx.fillRect(X, Y, 2, 6); cx.fillRect(X + 3, Y + 1, 2, 5); cx.fillRect(X - 3, Y + 2, 2, 4); }
    }
    // 캠프
    cx.fillStyle = '#c9a46b'; cx.beginPath(); cx.moveTo(px(0.6), px(ARENA.h / 2 + 1.2)); cx.lineTo(px(1.8), px(ARENA.h / 2 - 1.2)); cx.lineTo(px(3), px(ARENA.h / 2 + 1.2)); cx.fill();
    cx.fillStyle = '#5a4022'; cx.fillRect(px(1.65), px(ARENA.h / 2), px(0.3), px(1.2));
  }

  function drawZone(S, win) {
    const z = S.mon.zone;
    if (!z || !(S.mon.state === 'tele' || S.mon.state === 'act')) return;
    const pulse = 0.25 + 0.15 * Math.sin(performance.now() / 120) + (win ? 0.15 : 0);
    cx.fillStyle = `rgba(230,40,30,${pulse})`; cx.strokeStyle = 'rgba(255,90,70,.9)'; cx.lineWidth = 2;
    cx.beginPath();
    if (z.type === 'circle') cx.arc(px(z.x), px(z.y), px(z.r), 0, 7);
    if (z.type === 'spin') { cx.moveTo(px(z.x), px(z.y)); cx.arc(px(z.x), px(z.y), px(z.r), z.a + 0.45, z.a - 0.45 + Math.PI * 2); cx.closePath(); }
    if (z.type === 'cone') { cx.moveTo(px(z.x), px(z.y)); cx.arc(px(z.x), px(z.y), px(z.r), z.a - z.spread, z.a + z.spread); cx.closePath(); }
    if (z.type === 'line') {
      const a = Math.atan2(z.y2 - z.y1, z.x2 - z.x1), nx = -Math.sin(a) * px(z.w), ny = Math.cos(a) * px(z.w);
      cx.moveTo(px(z.x1) + nx, px(z.y1) + ny); cx.lineTo(px(z.x2) + nx, px(z.y2) + ny); cx.lineTo(px(z.x2) - nx, px(z.y2) - ny); cx.lineTo(px(z.x1) - nx, px(z.y1) - ny); cx.closePath();
    }
    cx.fill(); cx.stroke();
  }

  // ---------- 헌터 ----------
  function drawHunter(h, S) {
    const a = art[h.d.art], M = meta[h.d.art].anims;
    let anim = h.anim, row = h.face, frame, hold = false;
    if (h.state === 'faint') { anim = 'hurt'; hold = true; }
    else if (h.state === 'down') anim = 'hurt';
    else if (h.state === 'stun') anim = 'hurt';
    else if (h.state === 'evade') anim = 'jump';
    else if (h.state === 'guarding') anim = 'combat';
    else if (h.state === 'attack' || h.state === 'counter' || h.state === 'cast') anim = 'attack';
    const mm = M[anim] || M.idle;
    if (anim === 'hurt') row = 0;
    if (anim === 'attack') { const tot = h.d.atkTime * (h.state === 'counter' ? 1.3 : 1) * (h.state === 'cast' ? 0.6 : 1); frame = Math.min(mm.cols - 1, Math.floor(h.animT / tot * mm.cols)); }
    else if (anim === 'hurt' || anim === 'jump') frame = hold ? mm.cols - 1 : Math.min(mm.cols - 1, Math.floor(h.animT * FPS[anim]));
    else if (h.state === 'stun') frame = 1;
    else frame = Math.floor(h.animT * (FPS[anim] || 6)) % mm.cols;
    const X = px(h.x), Y = px(h.y), Z = mm.size;
    cx.fillStyle = 'rgba(0,0,0,.22)'; cx.beginPath(); cx.ellipse(X, Y, 13, 5, 0, 0, 7); cx.fill();
    if (h.react) { cx.strokeStyle = h.react === 'evade' ? '#7fd4ff' : h.react === 'guard' ? '#ffe08a' : '#ffb347'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(X, Y, 16, 7, 0, 0, 7); cx.stroke(); }
    if (h.state === 'faint') cx.globalAlpha = 0.45;
    const img = a[anim] || a.idle;
    cx.drawImage(img, frame * Z, row * Z, Z, Z, Math.round(X - Z / 2), Math.round(Y - Z / 2 - 26), Z, Z);
    cx.globalAlpha = 1;
    // 머리 위 이름표
    cx.font = '700 11px sans-serif'; cx.textAlign = 'center';
    cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(X - 9, Y - 68, 18, 14);
    cx.fillStyle = '#fff'; cx.fillText(h.id, X, Y - 57);
    if (h.state === 'stun') { cx.fillStyle = '#ffe14d'; cx.fillText('★ ★', X, Y - 72); }
    if (h.state === 'faint') { cx.fillStyle = '#fff'; cx.fillText(`${Math.ceil(h.reviveT)}초`, X, Y - 72); }
  }

  // ---------- 몬스터 (코드로 그린 비룡) ----------
  function drawMonster(m, P, S) {
    const dead = m.state === 'dead', z = m.z || 0;
    const lift = z * 40, sc = 1 + z * 0.25;
    // 그림자
    cx.fillStyle = `rgba(0,0,0,${0.28 - z * 0.12})`;
    cx.beginPath(); cx.ellipse(px(m.x), px(m.y) + 6, px(3.2) * (1 + z * 0.4), px(2.0) * (1 + z * 0.4), m.a, 0, 7); cx.fill();
    cx.save();
    let jx = 0, jy = 0;
    if (m.state === 'flinch') { jx = (Math.random() - 0.5) * 6; jy = (Math.random() - 0.5) * 6; }
    if (m.state === 'tele') { jx = (Math.random() - 0.5) * 2; }
    cx.translate(px(m.x) + jx, px(m.y) - lift + jy);
    cx.scale(sc, sc);
    cx.translate(-px(m.x), -px(m.y));
    const base = dead ? '#7b5a55' : m.enraged ? '#d23a2a' : '#b9382c', dark = dead ? '#4d3a37' : '#6e1d17', belly = dead ? '#9c8a7a' : '#e8a25a';
    const outline = '#3a0f0b';
    // 꼬리
    const pts = [{ x: m.x - Math.cos(m.a) * 1.2, y: m.y - Math.sin(m.a) * 1.2, r: 1.15 }, ...P.tail];
    cx.strokeStyle = outline; cx.lineCap = 'round'; cx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < pts.length - 1; i++) {
      cx.lineWidth = px(pts[i].r * 1.6) + (pass ? 0 : 4);
      cx.strokeStyle = pass ? base : outline;
      cx.beginPath(); cx.moveTo(px(pts[i].x), px(pts[i].y)); cx.lineTo(px(pts[i + 1].x), px(pts[i + 1].y)); cx.stroke();
    }
    // 꼬리 끝 가시
    const tip = P.tail[P.tail.length - 1], pre = P.tail[P.tail.length - 2], ta = Math.atan2(tip.y - pre.y, tip.x - pre.x);
    cx.fillStyle = dark; cx.beginPath();
    cx.moveTo(px(tip.x + Math.cos(ta) * 1.2), px(tip.y + Math.sin(ta) * 1.2));
    cx.lineTo(px(tip.x + Math.cos(ta + 2.2) * 0.7), px(tip.y + Math.sin(ta + 2.2) * 0.7));
    cx.lineTo(px(tip.x + Math.cos(ta - 2.2) * 0.7), px(tip.y + Math.sin(ta - 2.2) * 0.7)); cx.fill();
    // 날개
    const flap = dead ? 0.3 : 0.75 + Math.sin(m.wing) * 0.25 + z * 0.3;
    for (const side of [-1, 1]) {
      const ca = Math.cos(m.a), sa = Math.sin(m.a), nx = -sa * side, ny = ca * side;
      const sx = m.x + ca * 0.8 + nx * 1.1, sy = m.y + sa * 0.8 + ny * 1.1;
      const tx = sx + nx * 5.6 * flap - ca * 1.0, ty = sy + ny * 5.6 * flap - sa * 1.0;
      const bx = m.x - ca * 2.0 + nx * 1.0, by = m.y - sa * 2.0 + ny * 1.0;
      const mx = sx + nx * 3.4 * flap - ca * 3.2, my = sy + ny * 3.4 * flap - sa * 3.2;
      cx.fillStyle = dead ? '#5e4642' : '#8f2b22'; cx.strokeStyle = outline; cx.lineWidth = 2;
      cx.beginPath(); cx.moveTo(px(sx), px(sy)); cx.lineTo(px(tx), px(ty)); cx.quadraticCurveTo(px((tx + mx) / 2 - ca * 0.3), px((ty + my) / 2 - sa * 0.3), px(mx), px(my)); cx.quadraticCurveTo(px((mx + bx) / 2 + nx * 0.4), px((my + by) / 2 + ny * 0.4), px(bx), px(by)); cx.closePath(); cx.fill(); cx.stroke();
      cx.strokeStyle = dark; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(px(sx), px(sy)); cx.lineTo(px(tx), px(ty)); cx.moveTo(px(sx), px(sy)); cx.lineTo(px(mx), px(my)); cx.stroke();
    }
    // 다리
    cx.fillStyle = dark;
    for (const side of [-1, 1]) { const nx = -Math.sin(m.a) * side, ny = Math.cos(m.a) * side; cx.beginPath(); cx.ellipse(px(m.x - Math.cos(m.a) * 0.6 + nx * 1.6), px(m.y - Math.sin(m.a) * 0.6 + ny * 1.6), px(0.55), px(0.4), m.a, 0, 7); cx.fill(); }
    // 몸통
    cx.save(); cx.translate(px(m.x), px(m.y)); cx.rotate(m.a);
    cx.fillStyle = base; cx.strokeStyle = outline; cx.lineWidth = 3;
    cx.beginPath(); cx.ellipse(0, 0, px(2.5), px(1.65), 0, 0, 7); cx.fill(); cx.stroke();
    cx.fillStyle = belly; cx.beginPath(); cx.ellipse(px(0.2), 0, px(1.6), px(0.45), 0, 0, 7); cx.fill();
    cx.fillStyle = dark; for (let i = -2; i <= 2; i++) { cx.beginPath(); cx.moveTo(px(i * 0.75 + 0.35), 0); cx.lineTo(px(i * 0.75 - 0.15), px(-0.28)); cx.lineTo(px(i * 0.75 - 0.15), px(0.28)); cx.fill(); }
    // 목
    cx.strokeStyle = outline; cx.lineWidth = px(1.25) + 4; cx.beginPath(); cx.moveTo(px(1.6), 0); cx.lineTo(px(3.0), 0); cx.stroke();
    cx.strokeStyle = base; cx.lineWidth = px(1.25); cx.beginPath(); cx.moveTo(px(1.6), 0); cx.lineTo(px(3.0), 0); cx.stroke();
    // 머리
    const open = (m.state === 'act' && (m.atk === 'bite' || m.atk === 'breath' || m.atk === 'roar')) || (m.state === 'tele' && m.atk === 'breath');
    cx.translate(px(3.4), 0);
    cx.fillStyle = dark; for (const s of [-1, 1]) { cx.beginPath(); cx.moveTo(px(-0.6), px(0.45 * s)); cx.lineTo(px(-1.9), px(0.95 * s)); cx.lineTo(px(-0.4), px(0.15 * s)); cx.fill(); }
    cx.fillStyle = base; cx.strokeStyle = outline; cx.lineWidth = 3;
    if (open) { for (const s of [-1, 1]) { cx.save(); cx.rotate(0.28 * s); cx.beginPath(); cx.ellipse(px(0.5), px(0.25 * s), px(1.15), px(0.42), 0, 0, 7); cx.fill(); cx.stroke(); cx.restore(); } cx.fillStyle = '#3b0a07'; cx.beginPath(); cx.ellipse(px(0.9), 0, px(0.6), px(0.3), 0, 0, 7); cx.fill(); }
    else { cx.beginPath(); cx.ellipse(px(0.3), 0, px(1.35), px(0.8), 0, 0, 7); cx.fill(); cx.stroke(); }
    const eye = dead ? '#555' : m.enraged ? '#fff36b' : '#ffd23f';
    cx.fillStyle = eye; for (const s of [-1, 1]) { cx.beginPath(); cx.arc(px(0.15), px(0.45 * s), m.enraged ? 4 : 3, 0, 7); cx.fill(); }
    if (m.state === 'tele' && m.atk === 'breath') { cx.fillStyle = `rgba(255,170,40,${0.5 + 0.4 * Math.sin(performance.now() / 60)})`; cx.beginPath(); cx.arc(px(1.4), 0, 8 + Math.random() * 5, 0, 7); cx.fill(); }
    cx.restore();
    // 흰빛 깜빡임 (예고)
    if (m.state === 'tele') { cx.globalAlpha = 0.15 + 0.15 * Math.sin(performance.now() / 80); cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(px(m.x), px(m.y), px(2.6), px(1.8), m.a, 0, 7); cx.fill(); cx.globalAlpha = 1; }
    if (m.state === 'stun' || m.state === 'flinch') { cx.fillStyle = '#ffe14d'; cx.font = '700 16px sans-serif'; cx.textAlign = 'center'; const t = performance.now() / 200; for (let i = 0; i < 3; i++) cx.fillText('★', px(P.head.x) + Math.cos(t + i * 2.1) * 18, px(P.head.y) - 26 + Math.sin(t + i * 2.1) * 6); }
    cx.restore();
  }

  function drawShots(S) {
    for (const s of S.shots) {
      if (s.kind === 'arrow') {
        cx.strokeStyle = '#5b3a1e'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(px(s.x), px(s.y)); cx.lineTo(px(s.x - Math.cos(s.a || 0) * 0.8), px(s.y - Math.sin(s.a || 0) * 0.8)); cx.stroke();
        if (s.big) { cx.fillStyle = '#ffb347'; cx.beginPath(); cx.arc(px(s.x), px(s.y), 5, 0, 7); cx.fill(); }
      } else { cx.fillStyle = s.big ? '#e7c8ff' : '#b58cff'; cx.beginPath(); cx.arc(px(s.x), px(s.y), s.big ? 7 : 4, 0, 7); cx.fill(); }
    }
  }
  function drawFx(S) {
    for (const f of S.fx) {
      const u = f.t / (f.life || 1);
      if (f.kind === 'fire') { cx.fillStyle = `rgba(255,${Math.round(200 - u * 150)},40,${1 - u})`; cx.beginPath(); cx.arc(px(f.x + f.vx * f.t), px(f.y + f.vy * f.t), 6 + u * 16, 0, 7); cx.fill(); }
      if (f.kind === 'dust') { cx.fillStyle = `rgba(180,160,120,${0.6 - u * 0.6})`; cx.beginPath(); cx.arc(px(f.x), px(f.y), 8 + u * 18, 0, 7); cx.fill(); }
      if (f.kind === 'ring') { cx.strokeStyle = f.color || `rgba(255,255,255,${1 - u})`; cx.globalAlpha = 1 - u; cx.lineWidth = 4; cx.beginPath(); cx.arc(px(f.x), px(f.y), px(f.r * u), 0, 7); cx.stroke(); cx.globalAlpha = 1; }
      if (f.kind === 'spark') { cx.fillStyle = `rgba(255,240,180,${1 - u})`; for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; cx.fillRect(px(f.x) + Math.cos(a) * u * 22 - 2, px(f.y) + Math.sin(a) * u * 22 - 2, 4, 4); } }
      if (f.kind === 'num') {
        cx.globalAlpha = Math.min(1, (1 - u) * 2);
        cx.font = `900 ${f.big ? 24 : 15}px sans-serif`; cx.textAlign = 'center';
        cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.7)';
        const y = px(f.y) - u * 26;
        cx.strokeText(f.text, px(f.x), y); cx.fillStyle = f.color; cx.fillText(f.text, px(f.x), y);
        cx.globalAlpha = 1;
      }
    }
  }
  // 카드에 쓸 얼굴 그림
  function portrait(canvas, artId) {
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(art[artId].idle, 0, 128, 64, 64, -8, -6, 80, 80);
  }

  return { init, draw, portrait, U };
})();
