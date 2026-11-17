# -*- coding: utf-8 -*-
"""집지니 네이버 블로그 대장 (2026-11-17 대표 「블로그 자동화 — 무조건 네이버, 일주일 2개」)

뼈대는 대표가 짠 평면도 대장 관리자(PlanLedgerManager)를 그대로 옮겼다:
  오류 코드 체계 · 기록 규격 검증(pydantic, 한글 이름) · 원자적 저장 · 상태 갱신 · 알림 갈래.
바뀐 점
  - 대상이 「단지」에서 「블로그 글」로: 상태 = 대기 → 초안 → 발행 (보류)
  - 텔레그램 열쇠를 이 저장소에 두지 않는다: 대장(data/blog-ledger.json)이 누리집에 올라가면
    집지니 콘솔(blog_watch.gs)이 읽어 8~21시에 텔레그램으로 알린다. 아래 알림 갈래는 그 대신 「알릴 것」 표시를 남긴다.
  - 네이버는 2020-05-06 글쓰기 연동을 없앴다 → 발행은 대표가 「본문 복사 → 붙여넣기 → 발행」(1분).
    발행 여부는 블로그 구독 주소(RSS)에서 제목을 찾아 스스로 「발행」으로 바꾼다(sync_rss).

사용
  python3 tools/blog/blog_ledger.py status          대장 요약
  python3 tools/blog/blog_ledger.py sync            블로그 구독 주소와 맞춰 발행 표시
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

ROOT = Path(__file__).resolve().parents[2]
LEDGER = ROOT / "data" / "blog-ledger.json"
BLOG_ID = "cloudstay_"
RSS = f"https://rss.blog.naver.com/{BLOG_ID}.xml"
KST = timezone(timedelta(hours=9))


def now_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")


# 1. 오류 코드 체계
class ErrorCode(str, Enum):
    SUCCESS = "SUCCESS"
    ERR_NO_TOPIC = "ERR_NO_TOPIC"        # 쓸 주제가 바닥남(같은 주제 되풀이 금지)
    ERR_NO_DATA = "ERR_NO_DATA"          # 주제 자료(공사비·견적)가 비어 있음
    ERR_DUPLICATE = "ERR_DUPLICATE"      # 이미 쓴 주제
    ERR_RSS = "ERR_RSS"                  # 블로그 구독 주소를 읽지 못함
    ERR_UNKNOWN = "ERR_UNKNOWN"


STATUSES = ("대기", "초안", "발행", "보류")


# 2. 기록 규격
class PostRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    post_id: str = Field(..., alias="글번호")              # 예: 2026-11-18-apt-A10027336
    kind: str = Field(..., alias="종류")                   # 단지공사비 · 누수 · 경매 · 실견적
    topic_key: str = Field(..., alias="주제키")            # 같은 주제 되풀이 막는 열쇠
    title: str = Field("", alias="제목")
    status: str = Field("대기", alias="상태")
    reason: Optional[str] = Field("", alias="이유")
    tags: List[str] = Field(default_factory=list, alias="태그")
    draft_url: Optional[str] = Field("", alias="초안주소")
    site_url: Optional[str] = Field("", alias="집지니주소")    # 글이 가리키는 누리집 쪽
    naver_url: Optional[str] = Field("", alias="네이버주소")
    created: Optional[str] = Field(None, alias="만든날")
    published: Optional[str] = Field(None, alias="발행날")
    attempt_count: int = Field(0, alias="시도횟수")
    notify: Optional[str] = Field("", alias="알릴것")       # 콘솔이 텔레그램으로 보낼 일(보낸 뒤 콘솔이 기억)


# 3. 알림 갈래 — 이 저장소에는 텔레그램 열쇠를 두지 않는다. 콘솔이 읽어 갈 표시만 남긴다.
class ConsoleNotifier:
    def mark(self, record: Dict[str, Any], what: str):
        record["알릴것"] = what


# 4. 대장 관리자
class BlogLedgerManager:
    def __init__(self, ledger_path: Path = LEDGER):
        self.ledger_path = Path(ledger_path)
        self.notifier = ConsoleNotifier()
        self.records: List[Dict[str, Any]] = self._load_ledger()

    def _load_ledger(self) -> List[Dict[str, Any]]:
        if not self.ledger_path.exists():
            return []
        try:
            d = json.loads(self.ledger_path.read_text(encoding="utf-8"))
            return d.get("글", []) if isinstance(d, dict) else d
        except Exception as e:
            print(f"대장 읽기 오류: {e}")
            return []

    def save_ledger(self):
        """원자적 저장 — 쓰다가 끊겨도 대장이 깨지지 않게"""
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.ledger_path.with_suffix(".tmp")
        body = {"블로그": f"https://blog.naver.com/{BLOG_ID}", "갱신": now_kst(), "글": self.records}
        tmp.write_text(json.dumps(body, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.ledger_path)

    def used_keys(self) -> set:
        return {r.get("주제키") for r in self.records if r.get("상태") != "보류"}

    def get_target_records(self, target_status: str = "초안") -> List[dict]:
        return [r for r in self.records if r.get("상태") == target_status]

    def add(self, **kw) -> Dict[str, Any]:
        rec = PostRecord(**kw).model_dump(by_alias=True)
        if rec["주제키"] in self.used_keys():
            raise ValueError(f"[{ErrorCode.ERR_DUPLICATE.value}] 이미 쓴 주제: {rec['주제키']}")
        rec["만든날"] = rec["만든날"] or now_kst()
        self.records.append(rec)
        self.save_ledger()
        return rec

    def update_record_status(self, post_id: str, status: str, error_code: ErrorCode = ErrorCode.SUCCESS,
                             reason: str = "", **fields):
        """글번호 기준으로 상태 갱신 + 규격 검증 + 알림 표시"""
        assert status in STATUSES, status
        for record in self.records:
            if record.get("글번호") != post_id:
                continue
            record["상태"] = status
            record["이유"] = f"[{error_code.value}] {reason}" if error_code != ErrorCode.SUCCESS else reason
            record["시도횟수"] = record.get("시도횟수", 0) + 1
            for k, v in fields.items():
                if v not in (None, "", []):
                    record[k] = v
            if status == "발행" and not record.get("발행날"):
                record["발행날"] = now_kst()
            try:
                PostRecord(**record)
            except Exception as e:
                print(f"규격 오류 {post_id}: {e}")
            if status == "초안":
                self.notifier.mark(record, "초안")
            elif status == "발행":
                self.notifier.mark(record, "발행")
            elif error_code != ErrorCode.SUCCESS:
                self.notifier.mark(record, "오류")
            self.save_ledger()
            return record
        return None

    # 5. 발행 확인 — 블로그 구독 주소에서 제목으로 찾는다
    def sync_rss(self, xml: Optional[str] = None) -> List[str]:
        if xml is None:
            try:
                req = urllib.request.Request(RSS, headers={"User-Agent": "Mozilla/5.0 jipjini-blog-ledger"})
                xml = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
            except Exception as e:
                print(f"[{ErrorCode.ERR_RSS.value}] {e}")
                return []
        items = re.findall(r"<item>(.*?)</item>", xml, re.S)
        posts = []
        for it in items:
            t = re.search(r"<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", it, re.S)
            l = re.search(r"<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</link>", it, re.S)
            if t and l:
                posts.append((norm(t.group(1)), l.group(1).strip().split("?")[0]))
        done = []
        for r in self.get_target_records("초안"):
            key = norm(r.get("제목", ""))
            if not key:
                continue
            hit = next((u for t, u in posts if t == key or (len(key) > 12 and (key[:20] in t or t[:20] in key))), None)
            if hit:
                self.update_record_status(r["글번호"], "발행", naver_url=hit)
                r["네이버주소"] = hit
                done.append(r["글번호"])
        if done:
            self.save_ledger()
        return done


def norm(s: str) -> str:
    s = re.sub(r"<[^>]+>", "", s or "")
    s = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'")
    return re.sub(r"\s+", "", s)


if __name__ == "__main__":
    m = BlogLedgerManager()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    if cmd == "sync":
        print("발행 확인:", m.sync_rss() or "새로 발행된 글 없음")
    else:
        from collections import Counter
        print("대장", len(m.records), "편 ·", dict(Counter(r.get("상태") for r in m.records)))
        for r in m.records[-5:]:
            print(" ", r.get("글번호"), r.get("상태"), r.get("제목"))
