// 전투장 시험판 수치. 규칙(sim.js)·머리(ai.js)·화면(view.js)은 여기 값을 읽기만 한다.
// 거리 단위 = 칸(1칸 = 32픽셀), 속도 = 칸/초, 시간 = 초

const TILE = 32;
const ARENA = { w: 26, h: 16 };
const TIME_LIMIT = 180;

// 유닛. role = 역할(헌터만), art = art/showcase/<art>/ 그림, attack = 기본 공격 동작, scale = 그림 크기 배율
const UNITS = {
  knight: { name: '기사', role: 'tank', hp: 300, armor: 0.3, spd: 3.0, range: 1.25, atk: 14, atkTime: 0.9, hitAt: 0.5, melee: true, art: 'knight', attack: 'slash_128', skills: ['taunt', 'block'] },
  gs: { name: '검사', role: 'dealer', hp: 180, armor: 0.1, spd: 3.4, range: 1.3, atk: 24, atkTime: 1.0, hitAt: 0.5, melee: true, art: 'gs', attack: 'slash_oversize', skills: ['whirl'] },
  archer: { name: '궁수', role: 'archer', hp: 140, armor: 0, spd: 3.3, range: 6.5, atk: 13, atkTime: 1.1, hitAt: 0.72, melee: false, art: 'bow', attack: 'shoot', skills: ['aimed'] },
  cleric: { name: '성직자', role: 'healer', hp: 150, armor: 0, spd: 3.1, range: 5, atk: 6, atkTime: 1.2, hitAt: 0.6, melee: false, art: 'staff', attack: 'spellcast', mana: 100, manaRegen: 4, skills: ['heal', 'bigheal'] },
  goblin: { name: '고블린', hp: 42, armor: 0, spd: 3.6, range: 1.1, atk: 8, atkTime: 0.9, hitAt: 0.5, melee: true, art: 'goblin', attack: 'slash', backMul: 1.5 },
  skel: { name: '해골', hp: 70, armor: 0, spd: 2.8, range: 1.1, atk: 12, atkTime: 1.0, hitAt: 0.5, melee: true, art: 'skel', attack: 'slash' },
  skel_archer: { name: '해골 궁수', hp: 48, armor: 0, spd: 2.6, range: 6, atk: 9, atkTime: 1.5, hitAt: 0.72, melee: false, art: 'skel_archer', attack: 'shoot', keepAway: 3 },
  ogre: { name: '오우거', hp: 2000, armor: 0.2, spd: 2.2, range: 1.8, atk: 44, atkTime: 1.8, hitAt: 0.6, melee: true, art: 'orc', attack: 'thrust', scale: 1.6, skills: ['slam'] },
};
const PARTY = ['knight', 'gs', 'archer', 'cleric'];
const PARTY_SPOTS = [[7, 8], [6.5, 9.8], [4.2, 6.4], [3.8, 9.4]];

// 스킬. tags = 꼬리표. 머리(ai.js)는 스킬 이름이 아니라 꼬리표만 보고 언제 쓸지 정한다.
//   새 스킬은 여기 한 줄만 적으면 된다 (꼬리표·숫자). 완전히 새로운 종류일 때만 ai.js 에 꼬리표 점수를 하나 더한다.
// cast = 시전 시간(0이면 즉시), range = 대상까지 가야 하는 거리(없으면 자기 자신), anim = 시전 동작 그림
const SKILLS = {
  taunt: { n: '도발', tags: ['보호', '어그로'], cd: 8, cast: 0.4, radius: 5, force: 3, anim: 'spellcast' },
  block: { n: '방패 막기', tags: ['방어'], cd: 12, cast: 0, dur: 3, reduce: 0.5 },
  whirl: { n: '회전 베기', tags: ['범위', '공격'], cd: 9, cast: 0.6, hitAt: 0.6, radius: 1.8, dmg: 30, anim: 'slash_reverse_oversize' },
  aimed: { n: '조준 사격', tags: ['강공격', '공격'], cd: 10, cast: 1.2, hitAt: 1, mult: 2.5, range: 6.5, anim: 'shoot' },
  heal: { n: '치유', tags: ['회복'], cd: 0, cast: 1, hitAt: 1, amount: 35, mana: 15, range: 5, anim: 'spellcast' },
  bigheal: { n: '큰 치유', tags: ['회복', '큰'], cd: 12, cast: 1.8, hitAt: 1, amount: 90, mana: 40, range: 5, anim: 'spellcast' },
  slam: { n: '내려찍기', tags: ['범위'], cd: 6, warn: 1.5, radius: 2.2, dmg: 110, reach: 4 },
};

// 역할별 우선순위: 위에서부터 보고, 점수가 MIN_SCORE 를 넘는 첫 줄에서 제일 높은 행동을 고른다.
//   피하기·거리두기·공격·모이기·후퇴는 누구나 가진 기본 행동, 나머지는 스킬 꼬리표.
const PRIORITY = {
  tank: ['피하기', '보호', '방어', '공격'],
  dealer: ['피하기', '범위', '공격'],
  archer: ['피하기', '거리두기', '강공격', '공격'],
  healer: ['피하기', '회복', '거리두기', '공격'],
};
// 국면마다 우선순위를 바꾸는 곳 (없으면 역할 기본)
const PHASE_PRIORITY = {
  gather: ['피하기', '모이기'],
  retreat: ['피하기', '회복', '후퇴'],
  regroup: ['피하기', '회복', '모이기'],
};
const MIN_SCORE = 0.3;
const THINK_EVERY = [0.12, 0.2];   // 생각하는 간격(초) 범위 = 반응 속도
const PHASE_NAMES = { gather: '모이기', engage: '교전', crisis: '위기', retreat: '후퇴', regroup: '재집결' };

// 감독 손잡이 = 성향. w = 점수 비중, board = 메모판 기준값, priority = 우선순위 바꾸기
const BASE_W = {
  target: { danger: 0.35, kill: 0.2, near: 0.25, focus: 0.2 },
  heal: { miss: 0.45, urg: 0.4, role: 0.15 },
  kite: 2.5,                                   // 근접 적이 이만큼 가까우면 거리를 둔다
};
const BASE_BOARD = { crisisHp: 0.35, retreatHp: 0.25, manaReserve: 0.25 };
const STYLES = {
  balance: { n: '균형', desc: '기본값', w: {}, board: {}, priority: {} },
  safe: { n: '안전 우선', desc: '힐 일찍, 거리 넉넉히, 마나 아끼기', w: { heal: { urg: 0.55 }, kite: 3.2, target: { danger: 0.5, kill: 0.1 } }, board: { crisisHp: 0.5, retreatHp: 0.4, manaReserve: 0.35 }, priority: {} },
  simple: { n: '비교용: 생각 없음', desc: '피하기·스킬 없이 가까운 적만 치고, 힐만 함', w: { target: { danger: 0, kill: 0, near: 1, focus: 0 } }, board: { retreatHp: 0 }, priority: { tank: ['공격'], dealer: ['공격'], archer: ['공격'], healer: ['회복', '공격'] } },
  rush: { n: '몰아치기', desc: '집중 공격, 후퇴 안 함, 마나 다 씀', w: { target: { focus: 0.45, kill: 0.35, danger: 0.2 }, kite: 1.8 }, board: { crisisHp: 0.25, retreatHp: 0, manaReserve: 0.1 }, priority: { tank: ['피하기', '공격', '보호', '방어'] } },
};

// 시험 상황
const SCENARIOS = {
  A: { n: 'A: 4 대 다수', units: ['goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'goblin', 'skel', 'skel', 'skel', 'skel_archer', 'skel_archer', 'skel_archer'] },
  B: { n: 'B: 거대 적 1', units: ['ogre'] },
  C: { n: 'C: 거대 적 + 부하', units: ['ogre', 'goblin', 'goblin', 'goblin', 'goblin'] },
};
