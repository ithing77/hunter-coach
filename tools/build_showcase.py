# 헌터 한 명의 "모든 동작" 그림을 만든다 (작업실 동작 보기용).
#   python -I tools/build_showcase.py <LPC 저장소 폴더> [헌터 id, 기본 gs]
# 결과: art/showcase/<id>/<동작>.png + art/showcase/<id>/showcase.json
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import build_hunters as B
from PIL import Image

HID = sys.argv[2] if len(sys.argv) > 2 else 'gs'
# LPC 생성기의 몸 동작 전부 (폴더 이름 기준)
BODY_ANIMS = ['idle', 'walk', 'run', 'combat_idle', 'jump', 'sit', 'emote', 'climb', 'hurt',
              'slash', 'backslash', 'halfslash', 'thrust', 'spellcast', 'shoot']
BIG = {'slash_oversize': ('slash', False, 192), 'slash_reverse_oversize': ('slash', True, 192), 'thrust_oversize': ('thrust', False, 192),
       'slash_128': ('slash', False, 128), 'backslash_128': ('backslash', False, 128), 'halfslash_128': ('halfslash', False, 128)}


def main():
    import armor_sets
    h = B.HUNTERS.get(HID) or armor_sets.SETS.get(HID) or armor_sets.ENEMIES.get(HID) or armor_sets.PARTY[HID]
    layers = []
    for part in h['parts']:
        rel, var, tint = (part + (None,))[:3]
        layers += B.layers_of(B.find_def(rel), h['sex'], var, tint)
    B.checkout({l['path'] for l in layers})
    layers.sort(key=lambda l: l['z'])
    od = os.path.join(B.OUT, 'showcase', HID)
    os.makedirs(od, exist_ok=True)
    meta = {}
    for anim in BODY_ANIMS:
        parts = [(l, B.file_for(l, anim)) for l in layers if not l['custom']]
        parts = [(l, f) for l, f in parts if f]
        body = next((f for l, f in parts if 'body/bodies' in l['path']), None)
        if not body:
            continue
        W, H = Image.open(body).size
        img = Image.new('RGBA', (W, H))
        for l, f in parts:
            im = B.load(f, l)
            img.alpha_composite(im.crop((0, 0, W, H)) if im.size != (W, H) else im)
        img.save(os.path.join(od, anim + '.png'))
        weapon = any(l['path'].startswith('weapon/') for l, f in parts)
        meta[anim] = {'size': 64, 'cols': W // 64, 'rows': H // 64, 'weapon': weapon}
    for anim, (src, rev, S) in BIG.items():
        big = [l for l in layers if l['custom'] == anim]
        if not big:
            continue
        pad = (S - 64) // 2
        items = []
        for l in layers:
            if l['custom'] == anim:
                f = B.file_for(l, anim)
                if f:
                    items.append((l['z'], 'big', Image.open(f).convert('RGBA')))
            elif not l['custom']:
                f = B.file_for(l, src)
                if f:
                    items.append((l['z'], 'small', B.load(f, l)))
        small = next(im for z, k, im in items if k == 'small')
        cols, rows = small.size[0] // 64, small.size[1] // 64
        img = Image.new('RGBA', (cols * S, rows * S))
        for z, k, im in sorted(items, key=lambda t: t[0]):
            if k == 'big':
                img.alpha_composite(im.crop((0, 0, cols * S, rows * S)))
            else:
                for r in range(rows):
                    for c in range(cols):
                        cc = cols - 1 - c if rev else c   # 거꾸로 베기는 몸 동작을 뒤에서부터
                        img.alpha_composite(im.crop((cc * 64, r * 64, cc * 64 + 64, r * 64 + 64)), (c * S + pad, r * S + pad))
        img.save(os.path.join(od, anim + '.png'))
        meta[anim] = {'size': S, 'cols': cols, 'rows': rows, 'weapon': True}
    json.dump(meta, open(os.path.join(od, 'showcase.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for k, v in meta.items():
        print(k, v)


main()
