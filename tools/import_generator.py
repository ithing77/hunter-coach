# LPC 생성기에서 내려받은 "ZIP: Split by animation" 파일을 작업실 그림으로 가져온다.
#   python -I tools/import_generator.py <압축 파일 | latest> <id> <이름> [설명]
#   latest = 내려받기 폴더에서 가장 최근 lpc_*_animations_*.zip
# 결과: art/showcase/<id>/<동작>.png + showcase.json + CREDITS.txt + character.json, art/showcase/sets.json 에 한 줄 추가
import glob, io, json, os, sys, zipfile
from PIL import Image

ART = os.path.join(os.path.dirname(__file__), '..', 'art')
# 생성기 동작 이름 → 작업실 동작 이름
RENAME = {'combat': 'combat_idle', '1h_backslash': 'backslash', '1h_halfslash': 'halfslash'}
# 생성기 그림은 한 줄이 13칸 너비로 고정이라, 동작마다 실제 칸 수만큼 자른다
COLS = {'idle': 2, 'walk': 9, 'run': 8, 'combat_idle': 2, 'jump': 5, 'sit': 3, 'emote': 3, 'climb': 6, 'hurt': 6,
        'slash': 6, 'backslash': 13, 'halfslash': 6, 'thrust': 8, 'spellcast': 7, 'shoot': 13}
SKIP = {'watering', '1h_slash'}


def latest_zip():
    fs = glob.glob(os.path.join(os.path.expanduser('~'), 'Downloads', 'lpc_*_animations_*.zip'))
    if not fs:
        raise SystemExit('내려받기 폴더에 lpc_..._animations_....zip 이 없음')
    return max(fs, key=os.path.getmtime)


def main():
    if len(sys.argv) < 4:
        raise SystemExit(__doc__ or '사용법: import_generator.py <zip|latest> <id> <이름> [설명]')
    src, hid, name = sys.argv[1:4]
    desc = sys.argv[4] if len(sys.argv) > 4 else 'LPC 생성기에서 만든 캐릭터'
    if src == 'latest':
        src = latest_zip()
    z = zipfile.ZipFile(src)
    od = os.path.join(ART, 'showcase', hid)
    os.makedirs(od, exist_ok=True)
    meta = {}
    for f in sorted(z.namelist()):
        if not f.endswith('.png') or not (f.startswith('standard/') or f.startswith('custom/')):
            continue
        anim = os.path.basename(f)[:-4]
        if anim in SKIP:
            continue
        im = Image.open(io.BytesIO(z.read(f))).convert('RGBA')
        if not im.getbbox():   # 이 캐릭터엔 없는 동작 (빈 그림)
            continue
        if f.startswith('standard/'):
            anim = RENAME.get(anim, anim)
            S, rows = 64, im.size[1] // 64
            cols = COLS.get(anim, im.size[0] // 64)
            im = im.crop((0, 0, cols * S, rows * S))
        else:   # 큰 무기 동작: 4방향이면 한 칸 크기 = 높이 / 4
            rows = 4 if im.size[1] >= 4 * 64 else 1
            S = im.size[1] // rows
            cols = im.size[0] // S
        im.save(os.path.join(od, anim + '.png'))
        meta[anim] = {'size': S, 'cols': cols, 'rows': rows, 'weapon': S > 64}
    if 'walk' not in meta:
        raise SystemExit('걷기 그림이 없음 — 동작별 압축(ZIP: Split by animation)이 맞는지 확인')
    json.dump(meta, open(os.path.join(od, 'showcase.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for f in ('credits/credits.txt', 'character.json'):
        if f in z.namelist():
            open(os.path.join(od, 'CREDITS.txt' if f.endswith('.txt') else 'character.json'), 'wb').write(z.read(f))
    sp = os.path.join(ART, 'showcase', 'sets.json')
    sets = [s for s in json.load(open(sp, encoding='utf-8')) if s['id'] != hid]
    sets.append({'id': hid, 'name': name, 'desc': desc, 'made': 'generator'})
    json.dump(sets, open(sp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(os.path.basename(src), '→ art/showcase/' + hid)
    for k, v in meta.items():
        print(' ', k, v)


main()
