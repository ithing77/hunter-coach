// 전투장을 화면 없이 여러 판 돌려 숫자를 본다: node tools/arena_test.js [상황 A|B|C|all] [성향 balance|safe|rush|simple|all] [판 수]
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, Set, Map };
vm.createContext(ctx);
for (const f of ['data.js', 'sheet.js', 'sim.js', 'ai.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'arena', f), 'utf8'), ctx, { filename: f });
const scns = (process.argv[2] || 'all') === 'all' ? ['A', 'B', 'C'] : [process.argv[2]];
const styles = (process.argv[3] || 'all') === 'all' ? ['balance', 'safe', 'rush', 'simple'] : [process.argv[3]];
const N = +process.argv[4] || 30;
const pct = v => v === null ? '  -  ' : (v * 100).toFixed(0).padStart(3) + '%';
console.log('상황 성향      승률  시간  쓰러짐 탱커가맞음 뒷줄피해 찍기회피 표적바꿈/분 넘친힐 넘친딜 떨림/분');
for (const sc of scns) for (const st of styles) {
  const rows = [];
  for (let k = 0; k < N; k++) rows.push(vm.runInContext(`runOne('${sc}', '${st}', ${1000 + k})`, ctx));
  const a = vm.runInContext('aggregate', ctx)(rows);
  console.log(`${sc}    ${st.padEnd(8)} ${pct(a.win)} ${a.time.toFixed(0).padStart(4)}초 ${a.deaths.toFixed(2).padStart(5)}  ${pct(a.tankPct)}      ${a.backDmg.toFixed(0).padStart(4)}    ${pct(a.slamDodge)}    ${a.switchPerMin.toFixed(1).padStart(5)}     ${pct(a.overhealPct)}  ${pct(a.overkillPct)}  ${a.flipPerMin.toFixed(1).padStart(5)}`);
}
