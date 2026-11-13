# -*- coding: utf-8 -*-
r"""묶음 경향 보기(2026-11-13 대표 「하나씩 미시적으로 볼 때보다 수천 장을 거시적으로 보면 공통 분모가 보인다」).
   상태.json(판정·점수·남은 규칙) 에 원본_목록.csv(지역·전용면적·그림 크기·네이버 등록 연도)를 붙여
   묶음마다 통과율·출고보류율·많이 걸린 규칙을 표로 쓴다 → D:\croll\자료\변환\트렌드.txt
   클로드는 이 파일 하나만 읽고 고칠 곳을 고른다(토큰 아끼기). pc_convert.py 가 200장마다 부른다.
   python trend.py [상태.json] [원본_목록.csv] [출력]"""
import io, contextlib, os
import csv,json,re,collections,sys,time
def main(stf, listf, outf):
  buf=io.StringIO()
  with contextlib.redirect_stdout(buf):
    _run(stf, listf)
  open(outf,'w',encoding='utf-8').write('묶음 경향 · '+time.strftime('%Y-%m-%d %H:%M')+'\n'+buf.getvalue())
  return buf.getvalue()
def _run(stf, listf):
  st=json.load(open(stf,encoding='utf-8')); A={}
  for r in csv.DictReader(open(listf,encoding='utf-8-sig')):
      if r['순서']=='1': A['%s_%s'%(r['단지코드'],r['평형'])]=r
  # 2026-11-14 대표 「컴퓨터가 옛 도면·새 도면 양식을 먼저 나누고, 변환된 걸 거시적으로 봐서 문제를 찾기로 했잖아」
  #   → 자료\분류\분류표.csv(양식·치수·범위·외곽·사선)를 붙여 양식 묶음별로 보고, 지금 판만 센다(옛 판 결과가 섞이면 고친 효과가 안 보임)
  C={}
  try:
      for r in csv.DictReader(open(os.path.join(os.path.dirname(os.path.dirname(stf)),'분류','분류표.csv'),encoding='utf-8-sig')):
          m=re.search(r'[\\/](A\d+)_[^\\/]*[\\/][^\\/_]*_([^\\/.]+)\.\w+$',r['파일'])
          if m: C.setdefault('%s_%s'%m.groups(),r)
  except Exception: pass
  last=max(st.values(),key=lambda v:v.get('때','')).get('판') if st else None
  rows=[]
  for k,v in st.items():
      if v.get('판')!=last: continue
      a=A.get(k); 
      if not a or v.get('판정')=='오류': continue
      m=re.search(r'/(20\d\d)\d{4}_',a.get('원래주소','')); yr=int(m.group(1)) if m else 0
      try: ar=float(a['전용면적'] or 0)
      except: ar=0
      rules=re.findall(r'R(\d+?)(\d)(?=\s|$)',v.get('남은규칙','') or '')
      rs=set('R'+x for x,_ in rules) if not str(v.get('남은규칙','')).startswith('R0') else {'R0'}
      rows.append(dict(k=k,ok=v.get('판정')=='통과' or (v.get('판정')=='예외' and (v.get('점수') or 0)>=85),pan=v.get('판정'),sc=v.get('점수'),yr=yr,ar=ar,sido=a['시도'],sz=int(a.get('크기') or 0),sfx=re.sub(r'^\d+','',a['평형']),rs=rs,c=C.get(k) or {}))
  print('대상',len(rows),'· 판',last)
  def tab(name,f):
      g=collections.defaultdict(list)
      for r in rows: g[f(r)].append(r)
      print('\n■',name)
      for key in sorted(g,key=lambda x:str(x)):
          L=g[key]; c=collections.Counter(x for r in L for x in r['rs'])
          print(f'  {str(key):14} {len(L):4}장  통과 {sum(r["ok"] for r in L)/len(L)*100:5.1f}%  출고보류 {sum(r["pan"]=="출고보류" for r in L)/len(L)*100:5.1f}%  많은 규칙 '+', '.join(f'{a}:{b*100//len(L)}%' for a,b in c.most_common(4)))
  tab('도면 등록 연도(원본 주소)',lambda r: r['yr'] or '모름')
  tab('전용면적',lambda r: '~40' if r['ar']<40 else '40~60' if r['ar']<60 else '60~85' if r['ar']<=85 else '85~135' if r['ar']<=135 else '135~')
  tab('시도',lambda r: r['sido'])
  for col in ('양식','치수','범위','외곽','사선'):
      tab('양식 분류 · '+col,lambda r,col=col: r['c'].get(col) or '모름')
  # 공통 분모 찾기: 양식 조합 묶음 가운데 통과율이 평균의 절반 아래이거나 한 규칙이 평균의 두 배 넘게 몰린 곳
  base=sum(r['ok'] for r in rows)/max(1,len(rows)); bc=collections.Counter(x for r in rows for x in r['rs'])
  g=collections.defaultdict(list)
  for r in rows: g[r['c'].get('유형') or '모름'].append(r)
  print('\n■ 몰린 문제(양식 조합 · 15장 이상 · 고칠 차례 후보)')
  for key,L in sorted(g.items(),key=lambda x:-len(x[1])):
      if len(L)<15: continue
      c=collections.Counter(x for r in L for x in r['rs']); pr=sum(r['ok'] for r in L)/len(L)
      hot=[f'{a} {b*100//len(L)}%(평균 {bc[a]*100//max(1,len(rows))}%)' for a,b in c.most_common(6) if b/len(L)>=2*bc[a]/max(1,len(rows)) and b>=5]
      if pr<base/2 or hot: print(f'  {key:44} {len(L):4}장 통과 {pr*100:4.1f}%(평균 {base*100:.1f}%) '+'; '.join(hot))
  tab('그림 크기',lambda r: '~60KB' if r['sz']<60000 else '60~100KB' if r['sz']<100000 else '100~150KB' if r['sz']<150000 else '150KB~')


if __name__ == "__main__":
    D = r"D:\croll\자료"
    a = sys.argv[1:] + [None] * 3
    print(main(a[0] or os.path.join(D, "변환", "상태.json"), a[1] or os.path.join(D, "원본_목록.csv"), a[2] or os.path.join(D, "변환", "트렌드.txt")))
