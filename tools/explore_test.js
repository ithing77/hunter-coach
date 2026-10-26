// 탐험 시험판을 화면 없이 돌려 본다: node tools/explore_test.js [작전 카드 id] [판 수]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, Set, Map, Uint8Array };
vm.createContext(ctx);
for (const f of ['data.js', 'world.js', 'sim.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'explore', f), 'utf8'), ctx, { filename: f });
const card = process.argv[2] || 'defend', N = +process.argv[3] || 3;
let wins = 0;
for (let k = 0; k < N; k++) {
  vm.runInContext(`var G = newGame(${20261027 + k}); G.card = '${card}'; toggleAuto(G); var pauses = [];`, ctx);
  for (let i = 0; i < 30 * 60 * 15 && ctx.G.phase === 'play'; i++) {
    vm.runInContext(`step(G, STEP); if (G.pauseReq) { pauses.push(G.pauseReq.title + ' ' + G.pauseReq.lines.join(',')); G.pauseReq = null; } if (G.anchor.mode === 'hold' && !G.combat) toggleAuto(G);`, ctx);
  }
  const G = ctx.G;
  if (G.phase === 'won') wins++;
  console.log(`${k + 1}판 ${card}: ${G.phase} ${Math.round(G.t)}초 처치 ${G.stats.kills} 남은 무리 ${G.groups.filter(g => !g.done).length} 영웅 체력 ${G.units.filter(u => u.team === 'h').map(h => Math.round(h.hp)).join('/')}`);
  console.log('  멈춤:', ctx.pauses.slice(0, 8).join(' | '));
}
console.log(`승리 ${wins}/${N}`);
