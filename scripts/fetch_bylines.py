#!/usr/bin/env python3
"""Refresh bylines.json with Zack Abrams's latest stories on The Block.

The Block's bot protection returns 403 to GitHub's servers, so this tries
several routes and logs each one:
  1. the author page, fetched directly
  2. the author page through the r.jina.ai reader (a real browser)
  3. The Block's RSS feed, keeping only stories credited to Zack
Stories from an author page are only kept after their article page is
confirmed to carry his byline, so sidebar links to colleagues' stories
can't slip in. New finds are merged ahead of the previous list, and the
file is never overwritten with fewer than MIN_ITEMS stories.
"""
import html, json, re, sys, urllib.request
from datetime import datetime, timezone

AUTHOR = "Zack Abrams"
AUTHOR_URL = "https://www.theblock.co/author/zack-abrams/"
RSS_URL = "https://www.theblock.co/rss.xml"
READER = "https://r.jina.ai/"
BASE = "https://www.theblock.co"
OUT = "bylines.json"
MAX_ITEMS, MIN_ITEMS, MAX_CHECKS = 8, 3, 12
ARTICLE = re.compile(r"^/(post|news)/")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

def get(url, accept="text/html,application/xhtml+xml,*/*"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept,
                                               "Accept-Language": "en-US,en;q=0.9"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", "replace")

def direct(url):  return get(url)
def reader(url):  return get(READER + url, accept="text/plain")

def norm_url(u):
    if not isinstance(u, str) or not u:
        return None
    u = html.unescape(u.strip())
    if u.startswith(BASE):
        u = u[len(BASE):]
    if not u.startswith("/"):
        return None
    u = u.split("?")[0].split("#")[0]
    return BASE + u if ARTICLE.match(u) else None

def clean(t):
    t = html.unescape(re.sub(r"<[^>]+>", " ", t or ""))
    t = re.sub(r"[*_`#]+", "", t)
    return re.sub(r"\s+", " ", t).strip(" -|")

def dedupe(items):
    seen, out = set(), []
    for it in items:
        if it and it["url"] not in seen:
            seen.add(it["url"]); out.append(it)
    return out

def links_in(page):
    """Article links from HTML anchors or from reader markdown [title](url)."""
    found = []
    for m in re.finditer(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', page, re.S):
        found.append((m.group(1), m.group(2)))
    for m in re.finditer(r'\[([^\]]{20,300})\]\((https://www\.theblock\.co/[^)\s]+)\)', page):
        found.append((m.group(2), m.group(1)))
    out = []
    for href, text in found:
        url, title = norm_url(href), clean(text)
        if url and 25 <= len(title) <= 300 and not title.lower().startswith("image"):
            out.append({"title": title, "url": url})
    return dedupe(out)

def by_zack(fetch, url):
    try:
        page = fetch(url)
    except Exception as e:
        print(f"      could not check {url}: {e}")
        return False
    head = page[:20000]
    return AUTHOR in head or "/author/zack-abrams" in head

def from_author_page(fetch, label):
    try:
        page = fetch(AUTHOR_URL)
    except Exception as e:
        print(f"  [{label}] author page failed: {e}")
        return []
    cands = links_in(page)
    print(f"  [{label}] author page: {len(page):,} bytes, {len(cands)} candidate links")
    kept = []
    for c in cands[:MAX_CHECKS]:
        ok = by_zack(fetch, c["url"])
        print(f"      {'keep' if ok else 'skip'}: {c['title'][:80]}")
        if ok:
            kept.append(c)
        if len(kept) >= MAX_ITEMS:
            break
    return kept

def from_rss():
    try:
        xml = get(RSS_URL, accept="application/rss+xml,application/xml,text/xml")
    except Exception as e:
        print(f"  [rss] failed: {e}")
        return []
    items = re.findall(r"<item\b.*?</item>", xml, re.S)
    out = []
    for it in items:
        who = " ".join(re.findall(r"<(?:dc:creator|author)[^>]*>(.*?)</(?:dc:creator|author)>", it, re.S))
        if AUTHOR.lower() not in clean(who.replace("<![CDATA[", "").replace("]]>", "")).lower():
            continue
        t = re.search(r"<title[^>]*>(.*?)</title>", it, re.S)
        l = re.search(r"<link[^>]*>(.*?)</link>", it, re.S)
        title = clean((t.group(1) if t else "").replace("<![CDATA[", "").replace("]]>", ""))
        url = norm_url((l.group(1) if l else "").replace("<![CDATA[", "").replace("]]>", ""))
        d = re.search(r"<pubDate[^>]*>(.*?)</pubDate>", it, re.S)
        date = None
        if d:
            try:
                from email.utils import parsedate_to_datetime
                date = parsedate_to_datetime(d.group(1).strip()).strftime("%Y-%m-%d")
            except (TypeError, ValueError):
                pass
        if url and title:
            out.append({"title": title, "url": url, **({"date": date} if date else {})})
    print(f"  [rss] {len(items)} items in feed, {len(out)} by {AUTHOR}")
    if items:
        tags = sorted(set(re.findall(r"<([a-zA-Z][\w:]*)", items[0])))
        print(f"  [rss] fields per item: {', '.join(tags)}")
        seen = []
        for it in items:
            for m in re.findall(r"<(dc:creator|author|media:credit|creator)[^>]*>(.*?)</\1>", it, re.S):
                seen.append(clean(m[1].replace("<![CDATA[", "").replace("]]>", "")))
        print(f"  [rss] credited authors: {sorted(set(seen))[:25]}")
        if not seen:
            print(f"  [rss] first item: {re.sub(chr(10), ' ', items[0])[:700]}")
    return out

def main():
    try:
        old = json.load(open(OUT))
    except (OSError, ValueError):
        old = {"items": []}
    fresh, used = [], None
    for label, fn in (("direct", lambda: from_author_page(direct, "direct")),
                      ("reader", lambda: from_author_page(reader, "reader")),
                      ("rss", from_rss)):
        print(f"trying {label}")
        got = fn()
        if got:
            fresh, used = got, label
            break
    merged = dedupe(fresh + old.get("items", []))[:MAX_ITEMS]
    print(f"found {len(fresh)} new via {used}; {len(merged)} after merging with the previous list")
    if len(merged) < MIN_ITEMS:
        print(f"fewer than {MIN_ITEMS} stories; leaving {OUT} untouched")
        return 1
    if merged == old.get("items"):
        print("no change")
        return 0
    data = {"source": AUTHOR_URL, "via": used,
            "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "items": merged}
    with open(OUT, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False); f.write("\n")
    print(f"wrote {OUT}")
    for i in merged:
        print(f"  - {i['title'][:90]}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
