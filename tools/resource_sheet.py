# 그림 리소스 후보를 한 장으로 비교: 묶음마다 숫자(캐릭터·몬스터·보스·동작·변형) + 들어 있는 캐릭터를 같은 높이로 늘어놓기
#   python -I tools/resource_sheet.py → 리소스비교.png
import glob, json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
A = 'C:/AI/Assets/'
F_T = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 22)
F_B = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 14)
F_S = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 13)
WIDTH, TEXT_W, THUMB_H = 1800, 430, 56
BG, PANEL, INK, MUTED, GOLD = (29, 31, 26), (42, 44, 37), (241, 239, 232), (169, 167, 156), (240, 180, 41)

def crop_bbox(im):
    bb = im.getbbox()
    return im.crop(bb) if bb else im

def thumb(im, scale):
    im = crop_bbox(im)
    if scale != 1:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.NEAREST if scale >= 1 else Image.LANCZOS)
    return im

def frame(path, fw, fh, col=0, row=0):
    im = Image.open(path).convert('RGBA')
    return im.crop((col * fw, row * fh, col * fw + fw, row * fh + fh))

# ---------- 묶음마다 그림 모으기: [(이름표, [그림...])] ----------
def lpc():
    d = os.path.join(ROOT, 'art/showcase')
    heroes = [frame(f'{d}/{h}/idle.png', 64, 64, 0, 2) for h in ['gs', 'lance', 'bow', 'staff', 'rios', 'bone', 'golem', 'swamp', 'lion', 'frost']]
    foes = [frame(f'{d}/{h}/idle.png', 64, 64, 0, 2) for h in ['goblin', 'orc', 'skel', 'mino']]
    return [('지금 조립해 둔 것 (1배, 부위 조합으로 끝없이 만들 수 있음)', [thumb(i, 1) for i in heroes] + [thumb(i, 1) for i in foes])]

def tiny():
    out = []
    base = A + 'TinySwords/Tiny Swords (Free Pack)/Units/'
    for color in ['Blue', 'Red', 'Purple', 'Yellow', 'Black']:
        for u, f in [('Warrior', 'Warrior_Idle'), ('Lancer', 'Lancer_Idle'), ('Archer', 'Archer_Idle'), ('Monk', 'Idle'), ('Pawn', 'Pawn_Idle')]:
            p = f'{base}{color} Units/{u}/{f}.png'
            if os.path.exists(p):
                s = Image.open(p).height
                out.append(thumb(frame(p, s, s), 0.5))
    return [('유닛 5종 × 팀 색 5가지 (실제 크기의 절반으로 보여 줌)', out)]

def ninja():
    N = A + 'NinjaAdventure/Ninja Adventure - Asset Pack/Actor/'
    chars = [thumb(frame(p, 16, 16), 3) for p in sorted(glob.glob(N + 'Character/*/SpriteSheet.png'))]
    mons = []
    for d in sorted(glob.glob(N + 'Monster/*/')):
        sp = d + 'SpriteSheet.png'
        if not os.path.exists(sp):
            pngs = [f for f in sorted(glob.glob(d + '*.png')) if 'Faceset' not in f]
            if not pngs:
                continue
            sp = pngs[0]
        im = Image.open(sp).convert('RGBA'); s = min(16 if im.height % 16 == 0 else im.height, im.height)
        mons.append(thumb(im.crop((0, 0, s, s)), 3))
    bosses = []
    for d in sorted(glob.glob(N + 'Boss/*/')):
        idle = sorted(glob.glob(d + 'Idle*.png')) or sorted(glob.glob(d + 'Preview.png'))
        if idle:
            im = Image.open(idle[0]).convert('RGBA'); s = im.height
            im = im.crop((0, 0, s, s)) if 'Idle' in idle[0] else crop_bbox(im)
            im = crop_bbox(im); k = min(3, 96 / max(im.width, im.height))   # 보스는 96픽셀 안으로
            bosses.append(thumb(im, k))
    return [(f'캐릭터 {len(chars)} (3배 확대)', chars), (f'몬스터 {len(mons)} (3배)', mons), (f'보스 {len(bosses)} (크기 줄여 맞춤)', bosses)]

def minif():
    M = A + 'Minifantasy/Creatures/Minifantasy_Creatures_v3.3_Free_Version/Minifantasy_Creatures_Assets/'
    ims = []
    for p in sorted(glob.glob(M + '**/*Idle.png', recursive=True)):
        if '_Shadow' in p:
            continue
        ims.append(thumb(frame(p, 32, 32), 4))
    hero = glob.glob(A + 'Minifantasy/Dungeon/**/*Idle*.png', recursive=True)
    hero = [thumb(frame(p, 32, 32), 4) for p in hero if '_Shadow' not in p][:2]
    return [(f'괴물·종족 {len(ims)} (무료판 Creatures, 4배 확대)', ims), ('무료 Dungeon 의 영웅·오크 (4배)', hero)]

def mana():
    P = A + 'ManaSeed/char_a_p1/'
    out = []
    looks = [('v00', 'fstr_v01', 'bob1_v03', None), ('v03', 'pfpn_v02', 'dap1_v07', None), ('v06', 'fstr_v03', 'bob1_v10', 'pfht_v01'),
             ('v09', 'pfpn_v04', 'dap1_v01', 'pnty_v02'), ('v01', 'fstr_v05', 'dap1_v12', None), ('v05', 'pfpn_v05', 'bob1_v06', 'pfht_v04'),
             ('v08', 'fstr_v02', 'bob1_v13', None), ('v10', 'pfpn_v01', 'dap1_v04', 'pnty_v05')]
    for skin, outfit, hair, hat in looks:
        layers = [f'{P}char_a_p1_0bas_humn_{skin}.png', f'{P}1out/char_a_p1_1out_{outfit}.png', f'{P}4har/char_a_p1_4har_{hair}.png'] + ([f'{P}5hat/char_a_p1_5hat_{hat}.png'] if hat else [])
        im = Image.new('RGBA', (64, 64))
        for l in layers:
            if os.path.exists(l):
                im.alpha_composite(frame(l, 64, 64))
        out.append(thumb(im, 2))
    return [('기본 몸에 옷·머리·모자 조합 예시 (무료 체험판 재료만, 2배 확대)', out)]

RES = [
    {'name': 'Universal LPC', 'f': lpc, 'price': '무료', 'lic': 'CC-BY-SA·OGA-BY·GPL — 제작자 표시 필수, 재배포 OK',
     'facts': ['시점: 위에서 4방향 · 64칸 (사람 키 약 46픽셀)', '부위 657종: 갑옷 3·투구 25·무기 32·방패 50+', '쇠 색 8 · 천 색 16+ · 몸 6종 · 괴물 머리 20+',
               '동작 17 (구르기·막기 없음, 부위마다 빠진 동작 있음)', '몬스터: 사람 몸 + 괴물 머리 정도. 큰 몬스터 없음'],
     'good': '옷·무기 조합 자유도 최고', 'bad': '작고 평범한 그림체, 큰 몬스터 없음'},
    {'name': 'Tiny Swords (무료판)', 'f': tiny, 'price': '무료 (적 몬스터 묶음은 유료)', 'lic': '상업 OK · 수정 OK (Aseprite 원본 포함)',
     'facts': ['시점: 위에서 비스듬히, 좌우만 봄 · 192칸 (키 약 80픽셀)', '유닛 5종: 전사·방패창·궁수·수도승·일꾼', '팀 색 5가지 → 25가지',
               '동작: 전사 5 · 방패창 12(5방향) · 궁수 3 · 수도승 3', '무료판엔 몬스터·보스 없음'],
     'good': '크고 또렷함, 막기·치료 동작, 팀 구분 쉬움', 'bad': '종류가 아주 적음, 늘리려면 직접 그려야'},
    {'name': 'Ninja Adventure', 'f': ninja, 'price': '무료', 'lic': 'CC0 — 무엇이든 마음대로',
     'facts': ['시점: 위에서 4방향 · 16칸 (키 약 16픽셀)', '캐릭터 92 · 몬스터 66 · 보스 20 · 동물 26', '색만 다른 짝이 많음 (예: 용 파랑/초록)',
               '동작: 걷기·공격·점프 정도 (캐릭터 7줄)', '효과·아이템·타일·소리·음악까지 다 있음'],
     'good': '숫자 압도적, 보스 20, 완전 자유', 'bad': '아주 작은 그림, 동작 단순, 부위 조합 없음'},
    {'name': 'Minifantasy (무료판)', 'f': minif, 'price': '무료판 일부 · 전체 묶음 $69.99 (할인 중)', 'lic': '상업 OK · 수정 OK · 재판매 금지',
     'facts': ['시점: 위에서 4방향 · 32칸 (키 약 12픽셀, 아주 작음)', '무료 Creatures: 괴물·종족 26 (사람·오크·드워프·엘프·미노타우로스·트롤…)',
               '모든 괴물: 대기·걷기·점프·공격·맞기·죽기 6동작 × 4방향', '유료 묶음: 영웅 직업마다 고유 동작(막기·구르기·함성·폭탄)', '묶음 80개+ (보스·탈것·마법 효과 등)'],
     'good': '괴물 종류·동작이 고르게 다 있음, 직업 고유 스킬 동작', 'bad': '캐릭터가 아주 작음, 다 사면 $70'},
    {'name': 'Mana Seed (무료 체험판)', 'f': mana, 'price': '체험판 무료 · 전체 $19.98 + 옷 묶음 따로', 'lic': '상업 OK · 수정 OK (Aseprite 원본 포함)',
     'facts': ['시점: 위에서 4방향 · 64칸 (키 약 32픽셀)', '옷 갈아입히기: 몸·옷·머리·모자·무기·방패 층', '체험판: 피부 11 · 머리 2×색 14 · 옷 2×색 5 · 모자 2×색 5',
               '전투: 칼·방패 (체험판 포함), 활·창은 유료', '몬스터 없음 (별도 묶음)'],
     'good': '그림 수준 최고, 옷 갈아입히기', 'bad': '옷·머리를 직접 그려야 늘어남, 몬스터 없음'},
]

def flow(items, x0, w, y0, gap=8):
    """그림들을 줄바꿈하며 놓을 자리 계산"""
    x, y, rowh, pos = x0, y0, 0, []
    for im in items:
        if x + im.width > x0 + w:
            x, y = x0, y + rowh + gap; rowh = 0
        pos.append((x, y)); x += im.width + gap; rowh = max(rowh, im.height)
    return pos, y + rowh

panels = []
for r in RES:
    groups = r['f']()
    gx, gw = TEXT_W + 30, WIDTH - TEXT_W - 50
    y, layout = 18, []
    for title, ims in groups:
        layout.append(('t', title, (gx, y))); y += 22
        pos, y = flow(ims, gx, gw, y)
        layout += [('i', im, p) for im, p in zip(ims, pos)]
        y += 14
    h = max(y + 6, 250)
    p = Image.new('RGBA', (WIDTH - 28, h), PANEL)
    d = ImageDraw.Draw(p)
    d.text((18, 14), r['name'], font=F_T, fill=GOLD)
    d.text((18, 48), r['price'], font=F_B, fill=INK)
    d.text((18, 68), r['lic'], font=F_S, fill=MUTED)
    yy = 96
    for f in r['facts']:
        d.text((18, yy), '· ' + f, font=F_S, fill=INK); yy += 20
    d.text((18, yy + 6), '좋음: ' + r['good'], font=F_B, fill=(141, 209, 139))
    d.text((18, yy + 28), '아쉬움: ' + r['bad'], font=F_B, fill=(255, 140, 120))
    d.line((TEXT_W + 14, 14, TEXT_W + 14, h - 14), fill=(70, 72, 64), width=1)
    for kind, v, (x, yv) in layout:
        if kind == 't':
            d.text((x, yv), v, font=F_B, fill=MUTED)
        else:
            p.alpha_composite(v, (int(x), int(yv)))
    panels.append(p)

H = sum(p.height for p in panels) + 14 * (len(panels) + 1) + 170
out = Image.new('RGBA', (WIDTH, H), BG)
d = ImageDraw.Draw(out)
d.text((14, 12), '그림 리소스 비교 — 받은 무료판 기준 (확대 배율은 줄마다 적어 둠)', font=F_T, fill=INK)
# 원래 크기(1배) 한 줄: 화면에서 실제로 이만큼 차지해요
native = [('LPC', frame(os.path.join(ROOT, 'art/showcase/gs/idle.png'), 64, 64, 0, 2)),
          ('Tiny Swords', frame(A + 'TinySwords/Tiny Swords (Free Pack)/Units/Blue Units/Warrior/Warrior_Idle.png', 192, 192)),
          ('Ninja Adventure', frame(sorted(glob.glob(A + 'NinjaAdventure/Ninja Adventure - Asset Pack/Actor/Character/*/SpriteSheet.png'))[0], 16, 16)),
          ('Minifantasy', frame(sorted(glob.glob(A + 'Minifantasy/Creatures/**/HumanIdle.png', recursive=True))[0], 32, 32)),
          ('Mana Seed', frame(A + 'ManaSeed/char_a_p1/char_a_p1_0bas_humn_v00.png', 64, 64))]
x = 14
d.text((x, 52), '원래 크기(1배) 비교:', font=F_B, fill=GOLD); x += 150
for name, im in native:
    im = crop_bbox(im)
    out.alpha_composite(im, (x, 130 - im.height))
    d.text((x, 136), name, font=F_S, fill=MUTED); x += max(im.width, 110) + 30
y = 170
for p in panels:
    out.alpha_composite(p, (14, y)); y += p.height + 14
out.convert('RGB').save(os.path.join(ROOT, '리소스비교.png'))
print('ok', out.size)
