// 사냥을 화면 없이 여러 번 돌려 본다: node tools/autohunt.js [판 수] [명령 방식: none|smart]
Object.assign(global, require('../data.js'));
Object.assign(global, require('../sim.js'));
const N = +process.argv[2] || 20, mode = process.argv[3] || 'none';
let win = 0, tsum = 0, faint = 0, wins = 0;
for (let k = 0; k < N; k++) {
  const S = createHunt(k * 977 + 3);
  let windows = 0;
  while (S.phase === 'hunt') {
    if (S.windowReq) {
      windows++;
      const cmds = {};
      if (mode === 'smart') {
        let cp = S.cp;
        for (const h of S.hunters) {
          if (h.state === 'faint' || cp <= 0) continue;
          if (inZone(S.mon.zone, h.x, h.y)) { cmds[h.id] = h.id === 'B' ? 'guard' : 'evade'; cp--; }
          else if (h.hp < h.max * 0.4 && cp > 0) { cmds[h.id] = 'heal'; cp--; }
        }
      }
      applyCommands(S, cmds);
      S.windowReq = null;
    }
    stepHunt(S, STEP);
  }
  if (S.phase === 'won') { win++; tsum += S.t; }
  faint += S.faints;
  if (N <= 12) console.log(`${k + 1}: ${S.phase === 'won' ? '성공' : '실패(' + S.endWhy + ')'} ${Math.round(S.t)}초 창${windows} 쓰러짐${S.faints} 몬스터남은${Math.round(S.mon.hp)} 대미지 ${JSON.stringify(S.stats.dmg)}`);
}
console.log(`성공 ${win}/${N}, 평균 ${win ? Math.round(tsum / win) : '-'}초, 평균 쓰러짐 ${(faint / N).toFixed(1)}`);
