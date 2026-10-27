# 스킬 시트(구글 시트) → arena/sheet.js. "시트 반영해 줘" 때 쓴다.
#   시트 커넥터 get_values 로 직업·몬스터·스킬 탭을 읽어 {"직업": values, "몬스터": values, "스킬": values} JSON 으로 저장한 뒤
#   python -I tools/sheet_sync.py <json>
# 시트 주소: https://docs.google.com/spreadsheets/d/15sPuuAGJbLvGQA6hZ4GwZ3AP6FiIYGSPtr0_9lx9ZLg/edit
# sheet.js 는 data.js 다음에 읽혀서 UNITS·SKILLS 를 시트 값으로 바꾼다. 상태가 "아이디어"인 줄은 넣지 않는다.
import json, os, sys

OUT = os.path.join(os.path.dirname(__file__), '..', 'arena', 'sheet.js')
# 시트 칸 이름 → 게임 속 이름
UNIT_COLS = {'이름': 'name', '역할': 'role', '체력': 'hp', '방어': 'armor', '이동 속도': 'spd', '사거리': 'range', '공격력': 'atk',
             '공격 간격': 'atkTime', '맞는 순간': 'hitAt', '근접': 'melee', '마나': 'mana', '마나 회복': 'manaRegen', '그림': 'art',
             '기본 공격 동작': 'attack', '공격 동작': 'attack', '크기': 'scale', '거리 두기': 'keepAway', '뒷줄 노림': 'backMul'}
SKILL_COLS = {'이름': 'n', '쿨타임': 'cd', '시전 시간': 'cast', '맞는 순간': 'hitAt', '범위': 'radius', '사거리': 'range', '피해': 'dmg',
              '배율': 'mult', '회복': 'amount', '마나': 'mana', '지속': 'dur', '동작': 'anim'}


def val(s):
    s = str(s).strip()
    if s in ('예', '아니오'):
        return s == '예'
    try:
        f = float(s)
        return int(f) if f == int(f) else f
    except ValueError:
        return s


def rows(values):
    head = values[0]
    for r in values[1:]:
        r = dict(zip(head, r + [''] * (len(head) - len(r))))
        if r.get('id', '').strip() and r.get('상태', '').strip() != '아이디어':
            yield r


def main():
    tabs = json.load(open(sys.argv[1], encoding='utf-8'))
    skills, owner = {}, {}
    for r in rows(tabs['스킬']):
        s = {'tags': [t.strip() for t in r['꼬리표'].split(',') if t.strip()]}
        for k, v in SKILL_COLS.items():
            if str(r.get(k, '')).strip() != '':
                s[v] = val(r[k])
        for kv in r.get('기타', '').split(','):
            if '=' in kv:
                k, v = kv.split('=', 1)
                s[k.strip()] = val(v)
        skills[r['id']] = s
        owner.setdefault(r['직업'].strip(), []).append(r['id'])
    units = {}
    for tab in ('직업', '몬스터'):
        for r in rows(tabs[tab]):
            u = {}
            for k, v in UNIT_COLS.items():
                if str(r.get(k, '')).strip() != '':
                    u[v] = val(r[k])
            if r['id'] in owner:
                u['skills'] = owner[r['id']]
            units[r['id']] = u
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('// 스킬 시트에서 만든 파일 (tools/sheet_sync.py). 직접 고치지 말고 시트를 고친 뒤 다시 반영할 것.\n')
        f.write('const SHEET = ' + json.dumps({'units': units, 'skills': skills}, ensure_ascii=False, indent=1) + ';\n')
        f.write('Object.assign(UNITS, SHEET.units);\nObject.assign(SKILLS, SHEET.skills);\n')
    print('직업·몬스터', len(units), '/ 스킬', len(skills), '→ arena/sheet.js')


main()
