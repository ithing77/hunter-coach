# LPC 생성기의 부위 목록(종류·이름·변형·동작)을 표로 뽑는다: python -I tools/lpc_items.py <sheet_definitions 폴더> <출력.tsv>
import json, os, sys
root, out = sys.argv[1], open(sys.argv[2], 'w', encoding='utf-8')
for dp, _, fs in os.walk(root):
    for fn in sorted(fs):
        if not fn.endswith('.json') or fn.startswith('meta'):
            continue
        try:
            d = json.load(open(os.path.join(dp, fn), encoding='utf-8'))
        except Exception:
            continue
        if 'name' not in d:
            continue
        out.write('\t'.join([d.get('type_name', ''), d['name'], ','.join(d.get('variants', [])[:16]), ','.join(d.get('animations', [])), os.path.relpath(os.path.join(dp, fn), root)]) + '\n')
