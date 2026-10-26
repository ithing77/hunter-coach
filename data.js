// 수치·데이터. 시뮬레이션(sim.js)과 화면(view.js)은 이 값을 읽기만 한다.

// 경기장 크기 (단위 = 칸, 화면에서 1칸 = 24픽셀)
const ARENA = { w: 44, h: 28 };

// 헌터 4명. art: art/hunters/<art>/ 그림. range: 공격이 닿는 거리. prefer: 몬스터 어디를 노리나(head 머리 / side 몸통 옆).
const HUNTERS = [
  { id: 'A', art: 'gs', name: '바위', weapon: '대검', hp: 160, spd: 4.2, range: 2.6, prefer: 'head', atk: 70, atkTime: 2.0, hitAt: 0.55,
    guard: 0.45, autoDodge: 0.22, counter: 360, desc: '느리지만 한 방이 커요' },
  { id: 'B', art: 'lance', name: '방패', weapon: '방패창', hp: 180, spd: 3.8, range: 2.8, prefer: 'side', atk: 26, atkTime: 0.9, hitAt: 0.5,
    guard: 0.1, autoDodge: 0.15, autoGuard: 0.45, counter: 260, desc: '방패로 막는 게 특기예요' },
  { id: 'C', art: 'bow', name: '바람', weapon: '활', hp: 125, spd: 4.8, range: 10, prefer: 'side', atk: 20, atkTime: 1.15, hitAt: 0.75,
    guard: 0.75, autoDodge: 0.4, counter: 230, ranged: true, desc: '멀리서 꾸준히 쏴요' },
  { id: 'D', art: 'staff', name: '별빛', weapon: '지팡이', hp: 125, spd: 4.4, range: 7, prefer: 'side', atk: 12, atkTime: 1.3, hitAt: 0.7,
    guard: 0.75, autoDodge: 0.35, counter: 140, ranged: true, healer: true, desc: '다친 동료를 조금씩 치료해요' },
];

// 명령. cost = CP. only: 이 무기만 쓸 수 있음.
const COMMANDS = [
  { id: 'evade', n: '회피', cost: 1, icon: '↷', d: '공격 범위 밖으로 굴러요 (거의 확실)' },
  { id: 'guard', n: '가드', cost: 1, icon: '▣', d: '버티며 막아요. 방패창은 거의 다 막아요' },
  { id: 'counter', n: '반격', cost: 2, icon: '⚔', d: '반만 맞고, 큰 빈틈에 강한 한 방' },
  { id: 'heal', n: '회복', cost: 1, icon: '✚', d: '물약으로 체력 45 회복 (지팡이는 주변 모두)' },
  { id: 'flash', n: '섬광탄', cost: 3, icon: '✦', d: '큰 공격을 끊고 몬스터를 잠깐 눈멀게 해요', notFor: 'D' },
  { id: 'buff', n: '응원가', cost: 2, icon: '♪', d: '20초 동안 모두의 공격력 +40%', only: 'D' },
];
const CP = { max: 5, start: 3, regen: 7 };   // regen: 몇 초마다 1 회복

// 몬스터. 공격(attacks): tele = 예고 시간, big = 명령 창이 열리는 큰 공격.
const MONSTER = {
  name: '불꽃비룡 리오스', hp: 10000, speed: 3.2, turn: 1.7, enrageAt: 0.5, flinchEvery: 650,
  body: 2.3, headR: 1.3,
  attacks: {
    bite: { n: '물기', tele: 0.55, dmg: 10, big: false },
    tail: { n: '꼬리 휘두르기', tele: 1.3, dmg: 28, big: true, warn: '꼬리 휘두르기 준비!' },
    charge: { n: '돌진', tele: 1.3, dmg: 32, big: true, warn: '돌진 자세!' },
    breath: { n: '화염 브레스', tele: 1.5, dmg: 36, big: true, warn: '입에 불꽃이 모인다!' },
    roar: { n: '포효', tele: 1.1, dmg: 0, big: true, warn: '크게 숨을 들이쉰다… 포효!' },
    slam: { n: '날아올라 내려찍기', tele: 1.5, dmg: 42, big: true, warn: '하늘로 날아오른다!', enragedOnly: true },
  },
  rewards: ['리오스 비늘 ×3', '불꽃 주머니 ×1', '리오스 꼬리 ×1', '비룡의 골수 ×1'],
};

const RULES = { timeLimit: 15 * 60, faintsToFail: 3, windowSeconds: 20, reviveSeconds: 7 };

if (typeof module !== 'undefined') module.exports = { ARENA, HUNTERS, COMMANDS, CP, MONSTER, RULES };
