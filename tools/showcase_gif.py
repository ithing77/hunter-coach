# 작업실 동작 전부를 한 장짜리 움직이는 그림(GIF)으로: python -I tools/showcase_gif.py [헌터 id] [방향 0위 1왼 2아래 3오른]
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
HID = sys.argv[1] if len(sys.argv) > 1 else 'gs'
DIR = int(sys.argv[2]) if len(sys.argv) > 2 else 2
D = os.path.join(os.path.dirname(__file__), '..', 'art', 'showcase', HID)
meta = json.load(open(os.path.join(D, 'showcase.json'), encoding='utf-8'))
NAMES = {'idle': '대기', 'walk': '걷기', 'run': '달리기', 'combat_idle': '전투 대기', 'jump': '점프', 'sit': '앉기', 'emote': '감정 표현', 'climb': '오르기',
         'hurt': '맞고 쓰러지기', 'slash': '베기', 'backslash': '뒤로 베기', 'halfslash': '반 베기', 'thrust': '찌르기', 'spellcast': '마법 쓰기', 'shoot': '활 쏘기',
         'slash_oversize': '대검 베기', 'slash_reverse_oversize': '대검 올려 베기', 'thrust_oversize': '대검 찌르기'}
ONE_ROW = {'hurt', 'climb'}
keys = [k for k in NAMES if k in meta]
CW, CH, COLS, SC = 170, 190, 6, 1.5
font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 15)
imgs = {k: Image.open(os.path.join(D, k + '.png')).convert('RGBA') for k in keys}
rows = (len(keys) + COLS - 1) // COLS
frames = []
for t in range(48):
    canvas = Image.new('RGB', (CW * COLS, CH * rows), (127, 174, 87))
    dr = ImageDraw.Draw(canvas)
    for i, k in enumerate(keys):
        m, x0, y0 = meta[k], (i % COLS) * CW, (i // COLS) * CH
        S, f = m['size'], t % m['cols']
        r = 0 if k in ONE_ROW else DIR
        fr = imgs[k].crop((f * S, r * S, f * S + S, r * S + S))
        if S == 192:
            fr = fr.crop((40, 40, 152, 152))   # 큰 칸은 가운데 112칸만
        w = int(fr.width * SC)
        fr = fr.resize((w, w), Image.NEAREST)
        cx, feet = x0 + CW // 2, y0 + CH - 34
        dr.ellipse((cx - 20, feet - 6, cx + 20, feet + 4), fill=(104, 145, 70))
        body_feet = (59 if S == 64 else 64 - 40 + 59) * SC
        canvas.paste(fr, (int(cx - w / 2), int(feet - body_feet)), fr)
        dr.rectangle((x0 + 4, y0 + CH - 26, x0 + CW - 4, y0 + CH - 4), fill=(29, 31, 26))
        dr.text((cx, y0 + CH - 15), NAMES[k], font=font, fill=(241, 239, 232), anchor='mm')
        dr.rectangle((x0, y0, x0 + CW - 1, y0 + CH - 1), outline=(95, 143, 62))
    frames.append(canvas)
out = os.path.join(os.path.dirname(__file__), '..', f'모든동작_{HID}.gif')
frames[0].save(out, save_all=True, append_images=frames[1:], duration=110, loop=0, optimize=True)
print(out, os.path.getsize(out))
