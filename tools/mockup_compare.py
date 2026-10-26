# 구도 비교 그림: 같은 상황을 위에서(LPC) / 옆에서(HEROES 99) 본 장면을 나란히. 게임이 아니라 배치만.
#   python -I tools/mockup_compare.py  → 구도비교.png
import json, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(__file__)
ROOT = os.path.join(HERE, '..')
ASSETS = 'C:/AI/Assets/'
H99 = ASSETS + 'HEROES99/'
W, H = 768, 400
FONT = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 17)
SMALL = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 13)

def blend(canvas, draw_fn):
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    canvas.alpha_composite(layer)

# ---------- LPC (위에서) ----------
_lpc = {}
def lpc(hid, anim, row, col):
    key = (hid, anim)
    if key not in _lpc:
        d = os.path.join(ROOT, 'art', 'showcase', hid)
        _lpc[key] = (Image.open(os.path.join(d, anim + '.png')).convert('RGBA'), json.load(open(os.path.join(d, 'showcase.json'), encoding='utf-8'))[anim]['size'])
    im, S = _lpc[key]
    col = min(col, im.width // S - 1)
    return im.crop((col * S, row * S, col * S + S, row * S + S)), S

def put_lpc(canvas, hid, anim, row, col, x, y, scale=1):
    fr, S = lpc(hid, anim, row, col)
    fx, fy = S // 2, (59 if S == 64 else 64 + 59)   # 발 위치
    if scale != 1:
        fr = fr.resize((S * scale, S * scale), Image.NEAREST); fx *= scale; fy *= scale
    blend(canvas, lambda d: d.ellipse((x - 13 * scale, y - 4 * scale, x + 13 * scale, y + 3 * scale), fill=(0, 0, 0, 55)))
    canvas.alpha_composite(fr, (int(x - fx), int(y - fy)))

def grass():
    im = Image.new('RGBA', (W, H), (127, 174, 87, 255))
    d = ImageDraw.Draw(im)
    for y in range(0, H, 48):
        for x in range((y // 48) % 2 * 48, W, 96):
            d.rectangle((x, y, x + 47, y + 47), fill=(118, 164, 81))
    import random
    r = random.Random(3)
    for _ in range(40):
        x, y = r.randrange(W), r.randrange(H)
        if r.random() < 0.15:
            d.ellipse((x - 12, y - 8, x + 12, y + 8), fill=(138, 143, 134)); d.ellipse((x - 7, y - 6, x + 5, y + 1), fill=(167, 172, 162))
        else:
            d.rectangle((x, y, x + 1, y + 5), fill=(95, 143, 62)); d.rectangle((x + 3, y + 1, x + 4, y + 5), fill=(95, 143, 62))
    return im

DIRS = {'up': 0, 'left': 1, 'down': 2, 'right': 3}
def face(dx, dy):
    return DIRS['left' if dx < 0 else 'right'] if abs(dx) > abs(dy) else DIRS['up' if dy < 0 else 'down']

def top_swarm():
    im = grass()
    cx, cy = 384, 215
    blend(im, lambda d: d.ellipse((cx - 62, cy - 52, cx + 62, cy + 58), outline=(255, 255, 255, 140), width=2))
    items = [
        (cx - 38, cy + 5, 'gs', 'slash_oversize', 1, 3), (cx, cy - 32, 'lance', 'thrust', 0, 4),
        (cx + 40, cy + 8, 'bow', 'shoot', 3, 8), (cx, cy + 42, 'staff', 'spellcast', 2, 4)]
    import math
    foes = ['goblin', 'orc', 'goblin', 'skel', 'goblin', 'orc', 'skel', 'goblin', 'goblin', 'orc']
    for i, f in enumerate(foes):
        a = i / len(foes) * math.pi * 2 + 0.3
        r = 150 + (i % 3) * 22
        x, y = cx + math.cos(a) * r * 1.25, cy + math.sin(a) * r * 0.85
        items.append((x, y, f, 'walk' if i % 2 else 'slash', face(cx - x, cy - y), 2 + i % 4))
    for x, y, h, a, r, c in sorted(items, key=lambda t: t[1]):
        put_lpc(im, h, a, r, c, x, y)
    return im

def top_boss():
    im = grass()
    blend(im, lambda d: d.ellipse((470, 150, 650, 270), fill=(230, 40, 30, 60), outline=(255, 90, 70, 180), width=2))   # 보스 공격 범위 예시
    items = [
        (560, 245, 'mino', 'slash', 1, 2, 3),
        (445, 228, 'lance', 'combat_idle', 3, 0, 1), (640, 205, 'gs', 'slash_oversize', 1, 2, 1),
        (250, 300, 'bow', 'shoot', 3, 8, 1), (220, 165, 'staff', 'spellcast', 3, 3, 1),
        (300, 330, 'goblin', 'slash', 1, 3, 1), (180, 345, 'goblin', 'walk', 3, 4, 1), (150, 120, 'skel', 'slash', 3, 2, 1),
        (330, 95, 'goblin', 'walk', 2, 1, 1), (700, 340, 'orc', 'thrust', 1, 3, 1)]
    for x, y, h, a, r, c, s in sorted(items, key=lambda t: t[1]):
        put_lpc(im, h, a, r, c, x, y, s)
    return im

# ---------- HEROES 99 (옆에서) ----------
FW, FH, FX, FY = 100, 40, 41, 34
def hero_sheet(look):
    hair, hc = look.get('hair', (None, 0)); cloth, cc = look['cloth']; wn, wc = look.get('weapon', (0, None))
    def wpath(part):
        if isinstance(wn, str):
            return f'{ASSETS}custom/weapons/{wn}_{part}.png'
        return f'{H99}weapon/weapon{wn}/weapon{wn}_{part}/weapon{wn}' + (f'_c{wc}' if wc else '') + f'_{part}.png'
    paths = [wpath('bot') if wn else None, f'{H99}skin/skin_c{look["skin"]}.png', f'{H99}face/face_c{look["face"]}.png',
             f'{H99}hair/{hair}/{hair}_bot/{hair}_c{hc}_bot.png' if hair else None,
             f'{H99}cloth/cloth{cloth}/cloth{cloth}_bot/cloth{cloth}_c{cc}_bot.png',
             f'{H99}hair/{hair}/{hair}_top/{hair}_c{hc}_top.png' if hair else None,
             f'{H99}cloth/cloth{cloth}/cloth{cloth}_top/cloth{cloth}_c{cc}_top.png',
             f'{ASSETS}custom/shields/{look["shield"]}_layer.png' if look.get('shield') else None, wpath('top') if wn else None]
    base = None
    for p in paths:
        if p and os.path.exists(p):
            im = Image.open(p).convert('RGBA')
            if base is None:
                base = Image.new('RGBA', im.size)
            base.alpha_composite(im)
    return base

LOOKS = {
    'knight': {'skin': 1, 'face': 2, 'hair': ('m5', 4), 'cloth': (14, 2), 'weapon': (1, None), 'shield': 'kite_slim'},
    'lancer': {'skin': 2, 'face': 1, 'hair': ('m3', 1), 'cloth': (6, 4), 'weapon': (4, None)},
    'archer': {'skin': 1, 'face': 1, 'hair': ('f1', 1), 'cloth': (3, 1), 'weapon': ('bow', None)},
    'mage': {'skin': 1, 'face': 1, 'hair': ('f2', 6), 'cloth': (11, 5), 'weapon': (5, 1)},
}
_h = {}
def put_hero(canvas, who, row, col, x, y, flip=False, scale=2):
    if who not in _h:
        _h[who] = hero_sheet(LOOKS[who])
    fr = _h[who].crop((col * FW, row * FH, col * FW + FW, row * FH + FH))
    if flip:
        fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
    fr = fr.resize((FW * scale, FH * scale), Image.NEAREST)
    fx = (FW - FX if flip else FX) * scale
    blend(canvas, lambda d: d.ellipse((x - 11 * scale, y - 3 * scale, x + 11 * scale, y + 2 * scale), fill=(0, 0, 0, 60)))
    canvas.alpha_composite(fr, (int(x - fx), int(y - FY * scale)))

MON = {it['id']: it for it in json.load(open(ASSETS + 'monsters/monsters.json', encoding='utf-8'))}
_m = {}
def put_mon(canvas, mid, anim_i, frame, x, y, scale=2, flip=True):
    a = MON[mid]['anims'][anim_i]
    if a['src'] not in _m:
        _m[a['src']] = Image.open(ASSETS + 'monsters/' + a['src']).convert('RGBA')
    cw, ch = a['cell']; i = a['start'] + frame % a['frames']
    fr = _m[a['src']].crop(((i % a['cols']) * cw, (i // a['cols']) * ch, (i % a['cols']) * cw + cw, (i // a['cols']) * ch + ch))
    bb = fr.getbbox() or (0, 0, cw, ch)
    if flip:
        fr = fr.transpose(Image.FLIP_LEFT_RIGHT); bb = (cw - bb[2], bb[1], cw - bb[0], bb[3])
    fr = fr.resize((cw * scale, ch * scale), Image.NEAREST)
    footx = (bb[0] + bb[2]) / 2 * scale
    rx = (bb[2] - bb[0]) * scale * 0.4
    blend(canvas, lambda d: d.ellipse((x - rx, y - 3 * scale, x + rx, y + 2 * scale), fill=(0, 0, 0, 60)))
    canvas.alpha_composite(fr, (int(x - footx), int(y - bb[3] * scale)))

def forest():
    im = Image.new('RGBA', (W, H), (22, 32, 26, 255))
    bg = Image.open(H99 + 'bg.png').convert('RGBA').resize((768, 360), Image.NEAREST)
    im.alpha_composite(bg, (0, 40))
    return im

ROW = {'idle': 1, 'attack': 5, 'magic': 10, 'block': 15, 'run': 2}
def side_swarm():
    im = forest()
    items = [(255, 330, 'h', 'knight', ROW['block'], 1), (215, 365, 'h', 'lancer', ROW['attack'], 2),
             (120, 345, 'h', 'archer', ROW['attack'], 3), (85, 378, 'h', 'mage', ROW['magic'], 2)]
    xs = [(330, 335), (380, 368), (430, 340), (470, 380), (520, 352), (575, 335), (610, 372), (660, 345), (705, 378), (740, 335)]
    for i, (x, y) in enumerate(xs):
        items.append((x, y, 'm', 'au_goblin' if i % 3 else 'lm_skeleton', 0 if i % 2 else 2, i))
    for x, y, k, who, r, c in sorted(items, key=lambda t: t[1]):
        if k == 'h': put_hero(im, who, r, c, x, y)
        else: put_mon(im, who, r, c, x, y, scale=1 if who.startswith('lm') else 2, flip=True)
    return im

def side_boss():
    im = forest()
    blend(im, lambda d: d.rectangle((400, 320, 620, 385), fill=(230, 40, 30, 55), outline=(255, 90, 70, 170), width=2))
    items = [(560, 355, 'm', 'el_minotaur', 0, 0, 4), (395, 340, 'h', 'knight', ROW['block'], 1, 2), (330, 372, 'h', 'lancer', ROW['attack'], 3, 2),
             (150, 345, 'h', 'archer', ROW['attack'], 3, 2), (110, 380, 'h', 'mage', ROW['magic'], 3, 2),
             (230, 368, 'm', 'au_goblin', 2, 2, 2), (265, 335, 'm', 'au_goblin', 0, 1, 2), (690, 345, 'm', 'au_goblin', 0, 3, 2), (735, 378, 'm', 'lm_skeleton', 0, 1, 1)]
    for x, y, k, who, r, c, s in sorted(items, key=lambda t: t[1]):
        if k == 'h': put_hero(im, who, r, c, x, y, scale=s)
        else: put_mon(im, who, r, c, x, y, scale=s, flip=True)
    return im

# ---------- 묶기 ----------
def label(im, text):
    d = ImageDraw.Draw(im)
    w = d.textlength(text, font=FONT)
    d.rounded_rectangle((10, 10, 26 + w, 40), 8, fill=(20, 22, 18, 255)); d.text((18, 13), text, font=FONT, fill=(241, 239, 232))
    return im

rows = [('잡몹 떼 (4 대 다수)', top_swarm(), side_swarm()), ('거대 몬스터 + 부하', top_boss(), side_boss())]
G = 14
out = Image.new('RGBA', (W * 2 + G * 3, (H + G + 34) * len(rows) + G), (29, 31, 26, 255))
dd = ImageDraw.Draw(out)
for i, (title, a, b) in enumerate(rows):
    y = G + i * (H + G + 34)
    dd.text((G, y + 6), title, font=FONT, fill=(240, 180, 41))
    out.alpha_composite(label(a, '위에서 보기 · LPC'), (G, y + 34))
    out.alpha_composite(label(b, '옆에서 보기 · HEROES 99'), (G * 2 + W, y + 34))
out.convert('RGB').save(os.path.join(ROOT, '구도비교.png'))
print('ok', out.size)
