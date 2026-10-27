# 공통 무기 동작: 롱소드의 큰 동작 3개(내려베기·올려베기·찌르기)를 본보기로, 다른 무기 그림을 칸마다 같은 손잡이 자리·각도로 돌려 붙인다.
#   python -I tools/weapon_moves.py <LPC 저장소> [무기 id ...]   (무기 id = armor_sets.WEAPON_LIST, 기본: katana waraxe spear)
# 결과: art/showcase/w_<id>/ 에 없는 slash_oversize·slash_reverse_oversize·thrust_oversize 를 만들고 showcase.json 에 'auto': true 표시
#   (원래 그려진 동작은 건드리지 않음)
import json, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
IDS = sys.argv[2:]
sys.argv = sys.argv[:2]
import build_hunters as B
import armor_sets as S
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'art', 'showcase')
TPL = os.path.join(B.SHEETS, 'weapon', 'sword', 'longsword')
MOVES = {'slash_oversize': 'attack_slash', 'slash_reverse_oversize': 'attack_slash_reverse', 'thrust_oversize': 'attack_thrust'}
BODY = {'slash_oversize': ('slash', False), 'slash_reverse_oversize': ('slash', True), 'thrust_oversize': ('thrust', False)}
GRIP = {'칼': 0.13, '둔기': 0.16, '장병기': 0.38}   # 무기 길이 중 손이 쥐는 곳 (뒤끝에서부터)
WL = {k: (n, g, w) for k, n, g, w in S.WEAPON_LIST}


def is_hilt(p):   # 롱소드 손잡이·가드의 금색·갈색
    r, g, b, a = p
    return a > 0 and r > 120 and r > b + 50 and g > b + 20


def is_metal(p):
    r, g, b, a = p
    return a > 0 and max(r, g, b) - min(r, g, b) < 45 and max(r, g, b) > 70 or (a > 0 and b > r + 15 and b > 90)


def weapon_layers(k):
    layers = []
    for part in WL[k][2]:
        layers += B.layers_of(B.find_def(part[0]), 'male', part[1])
    B.checkout({l['path'] for l in layers})
    return layers


def pca(pts):
    n = len(pts)
    mx = sum(x for x, y in pts) / n; my = sum(y for x, y in pts) / n
    sxx = sum((x - mx) ** 2 for x, y in pts) / n; syy = sum((y - my) ** 2 for x, y in pts) / n; sxy = sum((x - mx) * (y - my) for x, y in pts) / n
    t = 0.5 * math.atan2(2 * sxy, sxx - syy)
    ux, uy = math.cos(t), math.sin(t)
    proj = [(x - mx) * ux + (y - my) * uy for x, y in pts]
    side = [-(x - mx) * uy + (y - my) * ux for x, y in pts]
    return (mx, my), (ux, uy), min(proj), max(proj), (sum(s * s for s in side) / n) ** 0.5


def opaque(im):
    px = im.load()
    return [(x, y) for y in range(im.size[1]) for x in range(im.size[0]) if px[x, y][3] > 0]


def upright(k):
    """그 무기의 모든 그림 칸 중 가장 길고 곧게 보이는 칸을 골라, 끝이 위로 서게 돌린 그림.
    똑바로 놓인 칸이 없으면 기울기 허용을 넓혀 가며 찾는다"""
    # 걷기 칸(무기를 그냥 든 모습, 잔상 없음)에서 먼저 찾고, 없으면 다른 동작에서. 뭉툭한 무기는 마지막에 잔상 거르기 없이
    for walk, tol, dense in ((1, 4, 5), (1, 12, 5), (1, 45, 6), (0, 4, 5), (0, 12, 5), (0, 45, 5)):
        best = pick_cell(k, tol, dense * (1.6 if WL[k][1] == '둔기' else 1), walk)   # 도끼·메이스는 머리가 넓어 점이 많음
        if best:
            return finish(k, best)
    return None   # 잔상 없이 무기만 그려진 칸이 없음 (곤봉 등) → 만들지 않음


def sheets_of(k):
    """동작마다 무기 층(앞·뒤)을 합친 그림. 삼지창·낫처럼 앞층·뒷층으로 나뉜 무기도 한 장으로"""
    out = {}
    for l in weapon_layers(k):
        for anim in ([l['custom']] if l['custom'] else ['walk', 'slash', 'thrust']):   # 맞기(hurt)는 무기가 조각나 있어 뺌
            f = B.file_for(l, anim)
            if not f:
                continue
            im = Image.open(f).convert('RGBA')
            if anim in out and out[anim].size == im.size:
                out[anim].alpha_composite(im)
            elif anim not in out:
                out[anim] = im
    return out


def pick_cell(k, tol, dense, walk_only):
    best = None
    for anim, im in sheets_of(k).items():
        if walk_only and not anim.startswith('walk'):
            continue
        Z = 192 if 'oversize' in anim else 128 if '128' in anim else 64
        for r in range(im.size[1] // Z):
            for c in range(im.size[0] // Z):
                cell = im.crop((c * Z, r * Z, c * Z + Z, r * Z + Z))
                pts = opaque(cell)
                if len(pts) < 12:
                    continue
                ctr, u, lo, hi, w = pca(pts)
                ang = math.degrees(math.atan2(u[1], u[0])) % 90
                if min(ang, 90 - ang) > tol:   # 똑바로 가로·세로로 놓인 칸만 (비스듬한 칸을 돌리면 칼날이 톱니처럼 깨짐)
                    continue
                dens = len(pts) / max(1, hi - lo)
                if dens > dense:   # 휘두름 잔상이 낀 칸 (길이에 비해 점이 너무 많음)
                    continue
                score = (hi - lo) - 1.5 * w - 3 * max(0, dens - 3)   # 길고 가늘수록, 잔상이 적을수록
                if not best or score > best[0]:
                    best = (score, cell, ctr, u, lo, hi, Z, f'{anim} {r},{c}')
    return best


def finish(k, best):
    _, cell, (mx, my), (ux, uy), lo, hi, Z, where = best
    # 끝 쪽 = 쇠(회색·푸른빛, 칼날·도끼날·창끝)가 모인 쪽, 반대쪽이 손잡이
    px = cell.load()
    metal = [(x, y) for x, y in opaque(cell) if is_metal(px[x, y])]
    mp = sum((x - mx) * ux + (y - my) * uy for x, y in metal) / max(1, len(metal))
    e1 = (mx + ux * lo, my + uy * lo); e2 = (mx + ux * hi, my + uy * hi)
    tip, butt = (e2, e1) if mp > (lo + hi) / 2 else (e1, e2)
    ang = math.degrees(math.atan2(tip[1] - butt[1], tip[0] - butt[0]))
    rot = cell.rotate(ang + 90, resample=Image.NEAREST, expand=True)   # PIL 은 반시계: 끝 방향(ang) → 위(-90)
    rot = clean(rot.crop(rot.getbbox()))
    print(f'  {k}: {where} 에서 꺼냄, 길이 {rot.size[1]}')
    return rot


def clean(im):
    """떨어져 있는 작은 점(4칸 미만 덩어리)을 지운다"""
    px = im.load(); W, H = im.size; seen = set()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0 or (x, y) in seen:
                continue
            comp, st = [], [(x, y)]; seen.add((x, y))
            while st:
                cx, cy = st.pop(); comp.append((cx, cy))
                for nx in (cx - 1, cx, cx + 1):
                    for ny in (cy - 1, cy, cy + 1):
                        if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and px[nx, ny][3] > 0:
                            seen.add((nx, ny)); st.append((nx, ny))
            if len(comp) < 4:
                for cx, cy in comp:
                    px[cx, cy] = (0, 0, 0, 0)
    return im.crop(im.getbbox())


def template(move):
    """본보기 칸마다: 손잡이 자리, 끝 자리, 길이, 앞/뒤 층, 휘두름 잔상 여부"""
    front = Image.open(os.path.join(TPL, MOVES[move], 'longsword.png')).convert('RGBA')
    back = Image.open(os.path.join(TPL, MOVES[move], 'behind', 'longsword.png')).convert('RGBA')
    cols, rows = front.size[0] // 192, front.size[1] // 192
    out = []
    for r in range(rows):
        row = []
        for c in range(cols):
            box = (c * 192, r * 192, c * 192 + 192, r * 192 + 192)
            fc, bc = front.crop(box), back.crop(box)
            both = bc.copy(); both.alpha_composite(fc)
            px = both.load()
            pts = opaque(both)
            hil = [(x, y) for x, y in pts if is_hilt(px[x, y])]
            if not pts or not hil:
                row.append(None); continue
            hx = sum(x for x, y in hil) / len(hil); hy = sum(y for x, y in hil) / len(hil)
            far = max(pts, key=lambda p: math.dist(p, (hx, hy)))
            w = pca(pts)[4]
            row.append({'hilt': (hx, hy), 'tip': far, 'len': math.dist(far, (hx, hy)), 'front': len(opaque(fc)) >= len(pts) / 2, 'smear': w > 2.2 and move != 'thrust_oversize', 'img': both})
        out.append(row)
    return out, cols, rows


def place(wimg, grip_frac, t, ref):
    """세워 둔 무기 그림을 본보기 칸(t)의 손잡이 자리·각도·길이로 돌려 192칸 하나를 만든다"""
    k_len = max(0.3, min(1.0, t['len'] / ref))
    w = wimg.resize((wimg.size[0], max(1, round(wimg.size[1] * k_len))), Image.NEAREST)
    gx, gy = w.size[0] / 2, w.size[1] * (1 - grip_frac)
    ang = math.degrees(math.atan2(t['tip'][1] - t['hilt'][1], t['tip'][0] - t['hilt'][0]))
    turn = -(ang + 90)   # 위(-90) → 본보기 방향(ang). PIL rotate 는 반시계라 부호를 뒤집음
    rot = w.rotate(turn, resample=Image.NEAREST, expand=True)
    a = math.radians(-turn)   # 화면 좌표(y 아래)에서 시계 방향 회전각
    dx, dy = gx - w.size[0] / 2, gy - w.size[1] / 2
    gx2 = rot.size[0] / 2 + dx * math.cos(a) - dy * math.sin(a)
    gy2 = rot.size[1] / 2 + dx * math.sin(a) + dy * math.cos(a)
    cell = Image.new('RGBA', (192, 192))
    if t['smear']:   # 휘두름 잔상만 본보기에서 옅게 남긴다 (손잡이→끝 직선 둘레의 칼날·손잡이는 지움)
        ghost = t['img'].copy(); gp = ghost.load()
        (hx, hy), (tx, ty) = t['hilt'], t['tip']; L = math.dist((hx, hy), (tx, ty)) or 1
        for y in range(192):
            for x in range(192):
                p = gp[x, y]
                if p[3] == 0:
                    continue
                d = abs((tx - hx) * (hy - y) - (hx - x) * (ty - hy)) / L
                gp[x, y] = (0, 0, 0, 0) if d < 3 or is_hilt(p) else p[:3] + (p[3] * 40 // 100,)
        cell.alpha_composite(ghost)
    cell.alpha_composite(rot, (round(t['hilt'][0] - gx2), round(t['hilt'][1] - gy2)))
    return cell


def main():
    ids = IDS or ['katana', 'waraxe', 'spear']
    tpls = {m: template(m) for m in MOVES}
    ref = max(t['len'] for tpl, _, _ in tpls.values() for row in tpl for t in row if t and not t['smear'])
    for k in ids:
        wimg = upright(k)
        if wimg is None:
            print(f'  {k}: 무기만 깨끗이 그려진 칸이 없어 건너뜀'); continue
        frac = GRIP.get(WL[k][1], 0.15)
        for move, (tpl, cols, rows) in tpls.items():
            fr = Image.new('RGBA', (cols * 192, rows * 192)); bk = Image.new('RGBA', (cols * 192, rows * 192))
            for r in range(rows):
                for c in range(cols):
                    t = tpl[r][c]
                    if t:
                        (fr if t['front'] else bk).alpha_composite(place(wimg, frac, t, ref), (c * 192, r * 192))
            od = os.path.join(OUT, 'w_' + k)
            meta_f = os.path.join(od, 'showcase.json')
            meta = json.load(open(meta_f, encoding='utf-8'))
            if meta.get(move) and meta[move].get('weapon') and not meta[move].get('auto'):
                print(f'  {k} {move}: 원래 그려진 동작이 있어 그대로 둠'); continue
            # 무기 없는 몸(w_none)의 64칸 동작을 192칸 가운데에 놓고, 뒤 무기 → 몸 → 앞 무기 순서로
            src, rev = BODY[move]
            body = Image.open(os.path.join(OUT, 'w_none', src + '.png')).convert('RGBA')
            img = Image.new('RGBA', fr.size); img.alpha_composite(bk)
            for r in range(rows):
                for c in range(cols):
                    cc = cols - 1 - c if rev else c   # 올려베기는 몸 동작을 뒤에서부터
                    img.alpha_composite(body.crop((cc * 64, r * 64, cc * 64 + 64, r * 64 + 64)), (c * 192 + 64, r * 192 + 64))
            img.alpha_composite(fr)
            img.save(os.path.join(od, move + '.png'))
            meta[move] = {'size': 192, 'cols': cols, 'rows': rows, 'weapon': True, 'auto': True}
            json.dump(meta, open(meta_f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(k, 'ok')


main()
