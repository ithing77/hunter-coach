// 소리: 전투 규칙(sim.js)이 G.sfx 에 스킬 이름을 넣으면 화면 쪽(main.js·skills.html)이 꺼내서 튼다.
//   새 소리는 SFX 에 한 줄 (src = art/sfx 파일, vol = 크기 0~1). 출처는 art/sfx/CREDITS.txt
const Sound = (() => {
  const SFX = {
    block: { src: 'art/sfx/shling.mp3', vol: 0.6 },
  };
  const cache = {};
  let on = true;
  try { on = localStorage.getItem('arenaSound') !== 'off'; } catch (e) {}
  function play(k) {
    const s = SFX[k];
    if (!on || !s) return;
    const base = cache[k] || (cache[k] = new Audio(s.src));
    const a = base.paused ? base : base.cloneNode();   // 겹쳐 울릴 수 있게
    a.volume = s.vol; a.currentTime = 0; a.play().catch(() => {});
  }
  // 한 프레임 동안 쌓인 소리를 튼다 (같은 소리는 한 번만)
  function drain(G) {
    if (!G || !G.sfx) return;
    for (const k of new Set(G.sfx)) play(k);
    G.sfx.length = 0;
  }
  const set = v => { on = v; try { localStorage.setItem('arenaSound', v ? 'on' : 'off'); } catch (e) {} };
  return { play, drain, set, get on() { return on; } };
})();
