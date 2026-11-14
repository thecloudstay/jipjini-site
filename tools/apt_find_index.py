# -*- coding: utf-8 -*-
"""단지 찾기용 한 장짜리 목록 data/apt/find.json 을 만든다(누수·경매 도구가 이름으로 단지를 찾을 때 쓴다).
  행 = [단지코드, 단지명, 시도+구, 동, 사용승인 연도, 세대수, 평면 자료 있음(1/0)]
  python tools/apt_find_index.py   (tools/build_apt_map.py 를 다시 돌린 뒤 같이 돌린다)
"""
import json, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    idx = json.load(open(os.path.join(ROOT, 'data', 'apt', 'index.json'), encoding='utf-8'))
    names = {z['id']: (z['짧은시도'], z['이름']) for z in idx['구역']}
    rows = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'data', 'apt', '*.json'))):
        b = os.path.basename(f)[:-5]
        if b not in names: continue
        for x in json.load(open(f, encoding='utf-8')):
            rows.append([x['c'], x['n'], names[b][0] + ' ' + x.get('g', names[b][1]), x.get('d', ''), x.get('y', ''), x.get('h', 0),
                         1 if os.path.exists(os.path.join(ROOT, 'data', 'plans', x['c'] + '.json')) else 0])
    json.dump(rows, open(os.path.join(ROOT, 'data', 'apt', 'find.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(rows), '단지 ·', sum(r[6] for r in rows), '곳 평면 자료')


if __name__ == '__main__':
    main()
