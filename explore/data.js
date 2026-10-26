// 탐험 시험판 수치. 규칙(sim.js)·지도(world.js)·화면(view.js)은 여기 값을 읽기만 한다.
// 거리 단위 = 칸(타일 1칸 = 32픽셀), 속도 = 칸/초

const TILE = 32;
const MAP = { w: 70, h: 46, seed: 20261027, treeDensity: 0.13 };

// 유닛. art = art/showcase/<art>/ 그림, attack = 공격 동작 그림 이름, hitAt = 공격 동작 중 맞는 순간(0~1)
const UNITS = {
  knight: { name: '기사', hp: 240, spd: 3.1, range: 1.25, atk: 17, atkTime: 0.85, hitAt: 0.5, sight: 6, armor: 0.3, melee: true, art: 'knight', attack: 'slash_128' },
  archer: { name: '궁수', hp: 140, spd: 3.3, range: 6.5, atk: 13, atkTime: 1.1, hitAt: 0.72, sight: 9, armor: 0, melee: false, art: 'bow', attack: 'shoot' },
  goblin: { name: '고블린', hp: 42, spd: 3.6, range: 1.1, atk: 6, atkTime: 0.9, hitAt: 0.5, sight: 6, armor: 0, melee: true, art: 'goblin', attack: 'slash', hunts: 'weak' },
  orc: { name: '오크', hp: 150, spd: 2.0, range: 1.45, atk: 16, atkTime: 1.6, hitAt: 0.55, sight: 5, armor: 0.15, melee: true, art: 'orc', attack: 'thrust' },
  skel: { name: '해골', hp: 60, spd: 2.8, range: 1.1, atk: 9, atkTime: 1.0, hitAt: 0.5, sight: 6, armor: 0, melee: true, art: 'skel', attack: 'slash' },
  skel_archer: { name: '해골 궁수', hp: 48, spd: 2.6, range: 6, atk: 9, atkTime: 1.5, hitAt: 0.72, sight: 7, armor: 0, melee: false, art: 'skel_archer', attack: 'shoot', keepAway: 4.5 },
};
const PARTY = ['knight', 'archer'];

// 적 무리: 지도에서 놓일 대략의 자리(0~1 비율)와 구성
const GROUPS = [
  { at: [0.30, 0.30], units: ['goblin', 'goblin', 'orc'] },
  { at: [0.42, 0.72], units: ['skel', 'skel', 'skel_archer'] },
  { at: [0.58, 0.40], units: ['goblin', 'goblin', 'goblin'] },
  { at: [0.66, 0.50], units: ['orc', 'skel_archer', 'skel_archer'] },   // 위 무리와 가까워서 싸우면 끼어들기 쉬움
  { at: [0.86, 0.26], units: ['goblin', 'goblin', 'skel', 'orc'] },
];
const REINFORCE_RADIUS = 7;   // 싸움이 이만큼 가까우면 다른 무리가 끼어든다

// 단체 작전 카드 (기본 5장). 움직임 규칙은 sim.js 의 TACTICS 에 있다.
const CARDS = [
  { id: 'defend', n: '방어 진형', icon: '🛡', color: '#3a78c9', lines: ['기사가 앞에서 버티며 전진', '궁수는 기사 뒤에서 지원', '궁수를 노리는 적을 기사가 막음'] },
  { id: 'spread', n: '분산 대형', icon: '↔', color: '#2e9e6a', lines: ['서로 거리를 두고', '각자 특기대로 싸움', '궁수는 거리를 벌리며 쏨'] },
  { id: 'focus', n: '집중 공격', icon: '🎯', color: '#c9453a', lines: ['가까운 적 하나를', '둘이 같이 협공', '하나씩 빠르게 줄임'] },
  { id: 'man', n: '맨투맨', icon: '⚔', color: '#a061c9', lines: ['각자 다른 적을 맡음', '궁수는 원거리 적 우선', '궁수가 위험하면 기사가 커버'] },
  { id: 'retreat', n: '후퇴 대형', icon: '↩', color: '#c98a2e', lines: ['뒤로 물러나며 싸움', '적을 끌어당겨 유인', '느린 적과 빠른 적을 떼어 놓음'] },
];

// 멈추는 순간 (작전 타임)
const PAUSE_ON = { discover: true, reinforce: true, critical: true };   // critical 은 화면에서 켜고 끌 수 있음
const CRITICAL_HP = 0.25;
