# LPC 부위를 겹쳐 헌터 그림(동작별 띠)을 만든다.
#   python -I tools/build_hunters.py <LPC 저장소 폴더>
# 결과: art/hunters/<id>/<동작>.png, art/hunters/hunters.json(칸 크기·줄 수), art/CREDITS.txt(제작자 목록)
# 부위 고르는 곳은 아래 HUNTERS 표. 부위 이름은 LPC 생성기의 sheet_definitions 파일 경로.
import json, os, subprocess, sys
from PIL import Image

REPO = sys.argv[1]
DEFS = os.path.join(REPO, 'sheet_definitions')
SHEETS = os.path.join(REPO, 'spritesheets')
OUT = os.path.join(os.path.dirname(__file__), '..', 'art')

DARK = (0.42, 0.42, 0.48)   # 흰 기본색 옷을 어두운 쇠색으로 (곱하기)
BASE = [('body/body.json', None), ('head/heads/human/heads_human_male.json', None), ('head/faces/face_neutral.json', None)]
BASE_F = [('body/body.json', None), ('head/heads/human/heads_human_female.json', None), ('head/faces/face_neutral.json', None)]
HUNTERS = {
    'gs': {'sex': 'male', 'attack': 'slash_oversize', 'parts': BASE + [
        ('hair/short/hair_plain.json', None),
        # 판금 다리·신발은 전투 대기·뒤로 베기·반 베기 그림이 없어서, 그 동작에선 맨다리가 보인다 → 밑에 바지·장화·긴소매를 깔아 둔다
        ('legs/pants/legs_pants.json', None, DARK), ('feet/boots/feet_boots_revised.json', None, DARK), ('torso/shirts/longsleeve/torso_clothes_longsleeve.json', None, DARK),
        ('torso/armour/torso_armour_plate.json', None), ('legs/legs_armour.json', None), ('feet/feet_armour.json', None),
        ('headwear/helmets/helmets/hat_helmet_armet_simple.json', None), ('weapons/sword/weapon_sword_longsword.json', 'longsword')]},
    'lance': {'sex': 'male', 'attack': 'thrust', 'parts': BASE + [
        ('hair/short/hair_plain.json', None), ('torso/armour/torso_armour_legion.json', None),
        ('legs/legs_armour.json', None), ('feet/feet_armour.json', None),
        ('headwear/helmets/helmets/hat_helmet_legion.json', None),
        ('weapons/shields/heater/shield_heater_wood.json', None), ('weapons/polearm/weapon_polearm_spear.json', 'steel')]},
    'bow': {'sex': 'female', 'attack': 'shoot', 'parts': BASE_F + [
        ('hair/long/hair_ponytail.json', None), ('torso/armour/torso_armour_leather.json', None),
        ('legs/legs_pants.json', None), ('feet/feet_boots_basic.json', None),
        ('headwear/coverings/hoods/hat_hood_cloth.json', None),
        ('weapons/ranged/bow/weapon_ranged_bow_great.json', 'great'), ('weapons/ranged/bow/weapon_ranged_bow_arrow.json', 'arrow')]},
    'staff': {'sex': 'female', 'attack': 'spellcast', 'parts': BASE_F + [
        ('hair/long/hair_long_messy.json', None), ('torso/shirts/longsleeve/torso_clothes_longsleeve.json', None),
        ('legs/legs_pants.json', None), ('feet/feet_boots_basic.json', None),
        ('headwear/hats/magic/hat_magic_celestial.json', None), ('weapons/magic/weapon_magic_simple.json', 'simple')]},
}
STANDARD = ['walk', 'idle', 'combat', 'run', 'jump', 'hurt']
FOLDER = {'combat': 'combat_idle'}
OVERSIZE = {'slash_oversize': ('slash', 192), 'thrust_oversize': ('thrust', 192), 'slash_reverse_oversize': ('slash', 192)}


def find_def(rel):
    p = os.path.join(DEFS, rel)
    if os.path.exists(p):
        return json.load(open(p, encoding='utf-8'))
    # 이름이 조금 다르면 비슷한 파일을 찾는다
    want = os.path.basename(rel).replace('.json', '')
    for dp, _, fs in os.walk(DEFS):
        for fn in fs:
            if fn.replace('.json', '') == want:
                return json.load(open(os.path.join(dp, fn), encoding='utf-8'))
    raise SystemExit('부위 설명 파일을 못 찾음: ' + rel)


def layers_of(d, sex, variant, tint=None):
    out = []
    for k, v in d.items():
        if k.startswith('layer_') and isinstance(v, dict) and v.get(sex):
            z = v.get('zPos', 0)
            if isinstance(tint, tuple):   # 밑에 까는 옷(색 곱하기)은 몸 바로 위, 다른 옷보다 아래
                z = 11 + z / 1000
            out.append({'z': z, 'path': v[sex], 'custom': v.get('custom_animation'), 'variant': variant, 'tint': tint})
    return out


def load(f, layer):
    im = Image.open(f).convert('RGBA')
    t = layer.get('tint')
    if isinstance(t, dict):   # 색 바꾸기: 밝기에 따라 어두운색→중간색→밝은색
        c0, c1, c2 = t['ramp']
        lut = []
        for ch in range(3):
            lut += [int(c0[ch] + (c1[ch] - c0[ch]) * v / 128) if v < 128 else int(c1[ch] + (c2[ch] - c1[ch]) * (v - 128) / 127) for v in range(256)]
        a = im.split()[3]
        L = im.convert('L')
        im = Image.merge('RGB', (L, L, L)).point(lut).convert('RGBA')
        im.putalpha(a)
    elif t:
        r, g, b, a = im.split()
        im = Image.merge('RGBA', (r.point(lambda v: int(v * t[0])), g.point(lambda v: int(v * t[1])), b.point(lambda v: int(v * t[2])), a))
    return im


def file_for(layer, anim):
    base = os.path.join(SHEETS, layer['path'])
    folder = FOLDER.get(anim, anim)
    cands = []
    if layer['custom']:
        cands += [os.path.join(base, (layer['variant'] or '') + '.png')]
        cands += [os.path.join(base, f) for f in (os.listdir(base) if os.path.isdir(base) else []) if f.endswith('.png')]
    else:
        if layer['variant']:
            cands.append(os.path.join(base, folder, layer['variant'] + '.png'))
        cands.append(os.path.join(base, folder + '.png'))
        d = os.path.join(base, folder)
        if os.path.isdir(d):
            cands += [os.path.join(d, f) for f in sorted(os.listdir(d)) if f.endswith('.png')]
    for c in cands:
        if os.path.isfile(c):
            return c
    return None


def checkout(paths):
    # 필요한 부위 폴더만 저장소에서 받는다
    sp = os.path.join(REPO, '.git', 'info', 'sparse-checkout')
    have = set(open(sp, encoding='utf-8').read().split())
    want = {'/spritesheets/' + p.strip('/') + '/' for p in paths}
    if want - have:
        open(sp, 'w', encoding='utf-8').write('\n'.join(sorted(have | want)) + '\n')
        subprocess.run(['git', '-C', REPO, 'read-tree', '-mu', 'HEAD'], check=True)


def main():
    meta, credits = {}, {}
    defs = {}
    for hid, h in HUNTERS.items():
        defs[hid] = []
        for part in h['parts']:
            rel, var, tint = (part + (None,))[:3]
            d = find_def(rel)
            defs[hid].append(layers_of(d, h['sex'], var, tint))
            for c in d.get('credits', []):
                if c['file'].split('/')[0] in [l['path'].split('/')[0] for l in defs[hid][-1]] or True:
                    credits[c['file']] = c
    checkout({l['path'] for ls in defs.values() for lay in ls for l in lay})

    for hid, h in HUNTERS.items():
        layers = sorted([l for lay in defs[hid] for l in lay], key=lambda l: l['z'])
        od = os.path.join(OUT, 'hunters', hid)
        os.makedirs(od, exist_ok=True)
        meta[hid] = {'attack': h['attack'], 'anims': {}}
        for anim in STANDARD + ([] if h['attack'] in OVERSIZE else [h['attack']]):
            parts = [(l, file_for(l, anim)) for l in layers if not l['custom']]
            parts = [(l, f) for l, f in parts if f]
            body = next((f for l, f in parts if 'body/bodies' in l['path']), None)
            if not body:
                continue
            W, H = Image.open(body).size
            img = Image.new('RGBA', (W, H))
            for l, f in parts:
                im = load(f, l)
                img.alpha_composite(im.crop((0, 0, W, H)) if im.size != (W, H) else im)
            img.save(os.path.join(od, anim + '.png'))
            meta[hid]['anims'][anim] = {'size': 64, 'cols': W // 64, 'rows': H // 64}
        if h['attack'] in OVERSIZE:
            # 큰 무기 동작: 몸은 64칸 그림을 192칸 가운데에 놓고, 무기는 192칸 그림을 그대로 겹친다
            src, S = OVERSIZE[h['attack']]
            pad = (S - 64) // 2
            items = []
            for l in layers:
                if l['custom'] == h['attack']:
                    f = file_for(l, h['attack'])
                    if f:
                        items.append((l['z'], 'big', Image.open(f).convert('RGBA')))
                elif not l['custom']:
                    f = file_for(l, src)
                    if f:
                        items.append((l['z'], 'small', load(f, l)))
            small = next(im for z, k, im in items if k == 'small')
            cols, rows = small.size[0] // 64, small.size[1] // 64
            img = Image.new('RGBA', (cols * S, rows * S))
            for z, k, im in sorted(items, key=lambda t: t[0]):
                if k == 'big':
                    img.alpha_composite(im.crop((0, 0, cols * S, rows * S)))
                else:
                    for r in range(rows):
                        for c in range(cols):
                            fr = im.crop((c * 64, r * 64, c * 64 + 64, r * 64 + 64))
                            img.alpha_composite(fr, (c * S + pad, r * S + pad))
            img.save(os.path.join(od, 'attack.png'))
            meta[hid]['anims']['attack'] = {'size': S, 'cols': cols, 'rows': rows}
        else:
            os.replace(os.path.join(od, h['attack'] + '.png'), os.path.join(od, 'attack.png'))
            meta[hid]['anims']['attack'] = meta[hid]['anims'].pop(h['attack'])
        print(hid, {k: (v['cols'], v['rows'], v['size']) for k, v in meta[hid]['anims'].items()})

    json.dump(meta, open(os.path.join(OUT, 'hunters', 'hunters.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, 'CREDITS.txt'), 'w', encoding='utf-8') as f:
        f.write('헌터 그림: Universal LPC Spritesheet Character Generator 부위 사용\n')
        f.write('https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator\n\n')
        for c in credits.values():
            f.write(f"{c['file']}\n  작가: {', '.join(c.get('authors', []))}\n  라이선스: {', '.join(c.get('licenses', []))}\n  출처: {' '.join(c.get('urls', []))}\n\n")


if __name__ == '__main__':
    main()
