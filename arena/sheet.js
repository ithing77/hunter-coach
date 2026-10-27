// 스킬 시트에서 만든 파일 (tools/sheet_sync.py). 직접 고치지 말고 시트를 고친 뒤 다시 반영할 것.
const SHEET = {
 "units": {
  "knight": {
   "name": "기사",
   "role": "tank",
   "hp": 300,
   "armor": 0.3,
   "spd": 3,
   "range": 1.25,
   "atk": 14,
   "atkTime": 0.9,
   "hitAt": 0.5,
   "melee": true,
   "art": "knight",
   "attack": "slash_128",
   "skills": [
    "taunt",
    "block"
   ]
  },
  "gs": {
   "name": "검사",
   "role": "dealer",
   "hp": 180,
   "armor": 0.1,
   "spd": 3.4,
   "range": 1.3,
   "atk": 24,
   "atkTime": 1,
   "hitAt": 0.5,
   "melee": true,
   "art": "gs",
   "attack": "slash_oversize",
   "skills": [
    "whirl"
   ]
  },
  "archer": {
   "name": "궁수",
   "role": "archer",
   "hp": 140,
   "armor": 0,
   "spd": 3.3,
   "range": 6.5,
   "atk": 13,
   "atkTime": 1.1,
   "hitAt": 0.72,
   "melee": false,
   "art": "bow",
   "attack": "shoot",
   "skills": [
    "aimed"
   ]
  },
  "cleric": {
   "name": "성직자",
   "role": "healer",
   "hp": 150,
   "armor": 0,
   "spd": 3.1,
   "range": 5,
   "atk": 6,
   "atkTime": 1.2,
   "hitAt": 0.6,
   "melee": false,
   "mana": 100,
   "manaRegen": 4,
   "art": "staff",
   "attack": "spellcast",
   "skills": [
    "heal",
    "bigheal"
   ]
  },
  "goblin": {
   "name": "고블린",
   "hp": 42,
   "armor": 0,
   "spd": 3.6,
   "range": 1.1,
   "atk": 8,
   "atkTime": 0.9,
   "hitAt": 0.5,
   "melee": true,
   "art": "goblin",
   "attack": "slash",
   "backMul": 1.5
  },
  "skel": {
   "name": "해골",
   "hp": 70,
   "armor": 0,
   "spd": 2.8,
   "range": 1.1,
   "atk": 12,
   "atkTime": 1,
   "hitAt": 0.5,
   "melee": true,
   "art": "skel",
   "attack": "slash"
  },
  "skel_archer": {
   "name": "해골 궁수",
   "hp": 48,
   "armor": 0,
   "spd": 2.6,
   "range": 6,
   "atk": 9,
   "atkTime": 1.5,
   "hitAt": 0.72,
   "melee": false,
   "art": "skel_archer",
   "attack": "shoot",
   "keepAway": 3
  },
  "ogre": {
   "name": "오우거",
   "hp": 2000,
   "armor": 0.2,
   "spd": 2.2,
   "range": 1.8,
   "atk": 44,
   "atkTime": 1.8,
   "hitAt": 0.6,
   "melee": true,
   "art": "orc",
   "attack": "thrust",
   "scale": 1.6,
   "skills": [
    "slam"
   ]
  }
 },
 "skills": {
  "taunt": {
   "tags": [
    "보호",
    "어그로"
   ],
   "n": "도발",
   "cd": 8,
   "cast": 0.4,
   "radius": 5,
   "anim": "spellcast",
   "force": 3
  },
  "block": {
   "tags": [
    "방어"
   ],
   "n": "방패 막기",
   "cd": 12,
   "cast": 0,
   "dur": 3,
   "reduce": 0.5
  },
  "whirl": {
   "tags": [
    "범위",
    "공격"
   ],
   "n": "회전 베기",
   "cd": 9,
   "cast": 0.6,
   "hitAt": 0.6,
   "radius": 1.8,
   "dmg": 30,
   "anim": "slash_reverse_oversize"
  },
  "aimed": {
   "tags": [
    "강공격",
    "공격"
   ],
   "n": "조준 사격",
   "cd": 10,
   "cast": 1.2,
   "hitAt": 1,
   "range": 6.5,
   "mult": 2.5,
   "anim": "shoot"
  },
  "heal": {
   "tags": [
    "회복"
   ],
   "n": "치유",
   "cd": 0,
   "cast": 1,
   "hitAt": 1,
   "range": 5,
   "amount": 35,
   "mana": 15,
   "anim": "spellcast"
  },
  "bigheal": {
   "tags": [
    "회복",
    "큰"
   ],
   "n": "큰 치유",
   "cd": 12,
   "cast": 1.8,
   "hitAt": 1,
   "range": 5,
   "amount": 90,
   "mana": 40,
   "anim": "spellcast"
  },
  "slam": {
   "tags": [
    "범위"
   ],
   "n": "내려찍기",
   "cd": 6,
   "radius": 2.2,
   "dmg": 110,
   "warn": 1.5,
   "reach": 4
  }
 }
};
Object.assign(UNITS, SHEET.units);
Object.assign(SKILLS, SHEET.skills);
