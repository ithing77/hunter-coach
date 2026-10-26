# 구도 비교 2: LPC 장면(구도비교.png 에서 잘라 옴) vs Tiny Swords 무료판으로 같은 상황 배치
#   python -I tools/mockup_tiny.py  → 구도비교_TinySwords.png
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
TS = 'C:/AI/Assets/TinySwords/Tiny Swords (Free Pack)/'
W, H, G = 768, 400, 14
FONT = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 17)

def blend(canvas, fn):
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); fn(ImageDraw.Draw(layer)); canvas.alpha_composite(layer)

_s = {}
def sheet(color, unit, name):
    p = f'{TS}Units/{color} Units/{unit}/{name}.png'
    if p not in _s:
        _s[p] = Image.open(p).convert('RGBA')
    return _s[p]

def put(canvas, color, unit, name, frame, x, y, flip=False, scale=1):
    im = sheet(color, unit, name)
    S = im.height
    fr = im.crop((frame * S, 0, frame * S + S, S))
    bb = sheet(color, unit, name.replace('Attack1', 'Idle').replace('Attack2', 'Idle').replace('Guard', 'Idle').replace('Shoot', 'Idle').replace('Heal', 'Idle') if unit != 'Lancer' else 'Lancer_Idle').crop((0, 0, S, S)).getbbox() or (0, 0, S, S)
    if flip:
        fr = fr.transpose(Image.FLIP_LEFT_RIGHT); bb = (S - bb[2], bb[1], S - bb[0], bb[3])
    if scale != 1:
        fr = fr.resize((S * scale, S * scale), Image.NEAREST)
    fx, fy = (bb[0] + bb[2]) / 2 * scale, bb[3] * scale
    rx = (bb[2] - bb[0]) * scale * 0.38
    blend(canvas, lambda d: d.ellipse((x - rx, y - 6 * scale, x + rx, y + 5 * scale), fill=(0, 0, 0, 55)))
    canvas.alpha_composite(fr, (int(x - fx), int(y - fy)))

def ground():
    tm = Image.open(TS + 'Terrain/Tileset/Tilemap_color3.png').convert('RGBA')
    g = tm.getpixel((96, 96))
    im = Image.new('RGBA', (W, H), g)
    import random
    r = random.Random(5)
    for name, n in (('Bushes/Bushe1', 3), ('Rocks/Rock1', 4)):
        p = f'{TS}Terrain/Decorations/{name}.png'
        if os.path.exists(p):
            d = Image.open(p).convert('RGBA'); S = d.height; fr = d.crop((0, 0, S, S))
            for _ in range(n):
                im.paste(fr, (r.randrange(-S // 3, W - S // 2), r.choice([r.randrange(-S // 2, 0), r.randrange(H - S, H - S // 3)])), fr)   # 위·아래 가장자리에만
    return im

def ts_swarm():
    im = ground(); cx, cy = 384, 230
    blend(im, lambda d: d.ellipse((cx - 95, cy - 70, cx + 95, cy + 75), outline=(255, 255, 255, 150), width=3))
    items = [(cx - 50, cy + 5, 'Blue', 'Warrior', 'Warrior_Attack1', 2, True), (cx + 5, cy - 40, 'Blue', 'Lancer', 'Lancer_Up_Defence', 3, False),
             (cx + 55, cy + 10, 'Blue', 'Archer', 'Archer_Shoot', 5, False), (cx, cy + 50, 'Blue', 'Monk', 'Heal', 6, False)]
    import math
    foes = [('Red', 'Warrior', 'Warrior_Run', 2), ('Red', 'Archer', 'Archer_Idle', 1), ('Purple', 'Warrior', 'Warrior_Attack2', 1), ('Red', 'Lancer', 'Lancer_Run', 3),
            ('Black', 'Warrior', 'Warrior_Run', 4), ('Red', 'Warrior', 'Warrior_Attack1', 1), ('Purple', 'Archer', 'Archer_Shoot', 3), ('Black', 'Warrior', 'Warrior_Idle', 2)]
    for i, (c, u, n, f) in enumerate(foes):
        a = i / len(foes) * math.pi * 2 + 0.4
        x, y = cx + math.cos(a) * 285, cy + math.sin(a) * 150
        items.append((x, y, c, u, n, f, x > cx))
    for x, y, c, u, n, f, fl in sorted(items, key=lambda t: t[1]):
        put(im, c, u, n, f, x, y, flip=fl)
    return im

def ts_boss():
    im = ground()
    blend(im, lambda d: d.ellipse((440, 190, 690, 330), fill=(230, 40, 30, 55), outline=(255, 90, 70, 180), width=2))
    items = [(565, 290, 'Black', 'Warrior', 'Warrior_Attack1', 2, True, 2),
             (430, 270, 'Blue', 'Lancer', 'Lancer_Right_Defence', 3, False, 1), (690, 230, 'Blue', 'Warrior', 'Warrior_Attack2', 2, True, 1),
             (200, 330, 'Blue', 'Archer', 'Archer_Shoot', 5, False, 1), (230, 190, 'Blue', 'Monk', 'Heal', 6, False, 1),
             (290, 360, 'Red', 'Warrior', 'Warrior_Attack1', 2, True, 1), (75, 380, 'Red', 'Warrior', 'Warrior_Run', 3, False, 1),
             (110, 150, 'Purple', 'Warrior', 'Warrior_Run', 1, False, 1), (320, 80, 'Red', 'Archer', 'Archer_Shoot', 4, True, 1)]
    for x, y, c, u, n, f, fl, s in sorted(items, key=lambda t: t[1]):
        put(im, c, u, n, f, x, y, flip=fl, scale=s)
    return im

def label(im, text):
    d = ImageDraw.Draw(im); w = d.textlength(text, font=FONT)
    d.rounded_rectangle((10, 10, 26 + w, 40), 8, fill=(20, 22, 18, 255)); d.text((18, 13), text, font=FONT, fill=(241, 239, 232))
    return im

old = Image.open(os.path.join(ROOT, '구도비교.png')).convert('RGBA')
lpc_panels = [old.crop((G, G + i * (H + G + 34) + 34, G + W, G + i * (H + G + 34) + 34 + H)) for i in range(2)]
rows = [('잡몹 떼 (4 대 다수)', lpc_panels[0], ts_swarm()), ('거대 적 + 부하', lpc_panels[1], ts_boss())]
out = Image.new('RGBA', (W * 2 + G * 3, (H + G + 34) * 2 + G), (29, 31, 26, 255))
dd = ImageDraw.Draw(out)
for i, (title, a, b) in enumerate(rows):
    y = G + i * (H + G + 34)
    dd.text((G, y + 6), title, font=FONT, fill=(240, 180, 41))
    out.alpha_composite(a, (G, y + 34))
    out.alpha_composite(label(b, '위에서 보기 · Tiny Swords'), (G * 2 + W, y + 34))
out.convert('RGB').save(os.path.join(ROOT, '구도비교_TinySwords.png'))
print('ok')
