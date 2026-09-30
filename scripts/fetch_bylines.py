#!/usr/bin/env python3
"""Fetch Zack Abrams's latest stories from his author page on The Block
and write them to bylines.json for the homepage ticker.

The page structure isn't guaranteed, so this tries, in order:
  1. Next.js page data (__NEXT_DATA__)
  2. JSON-LD blocks
  3. Plain article links in the HTML
It refuses to overwrite bylines.json unless it finds at least MIN_ITEMS.
"""
import html, json, re, sys, urllib.request
from datetime import datetime, timezone

AUTHOR_URL = "https://www.theblock.co/author/zack-abrams"
BASE = "https://www.theblock.co"
OUT = "bylines.json"
MAX_ITEMS, MIN_ITEMS = 8, 3
ARTICLE = re.compile(r"^/(post|news)/")

def fetch(url):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")

def norm_url(u):
    if not isinstance(u, str) or not u:
        return None
    u = u.strip()
    if u.startswith(BASE):
        u = u[len(BASE):]
    if not u.startswith("/"):
        u = "/" + u
    u = u.split("?")[0].split("#")[0]
    return BASE + u if ARTICLE.match(u) else None

def clean(t):
    t = html.unescape(re.sub(r"<[^>]+>", " ", t or ""))
    return re.sub(r"\s+", " ", t).strip()

def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)

def from_objects(objs):
    out = []
    for d in objs:
        title = d.get("title") or d.get("headline") or d.get("name")
        if isinstance(title, dict):
            title = title.get("rendered")
        url = None
        for k in ("url", "link", "permalink", "canonical", "href", "mainEntityOfPage"):
            v = d.get(k)
            if isinstance(v, dict):
                v = v.get("@id") or v.get("url")
            url = norm_url(v)
            if url:
                break
        if not url and isinstance(d.get("slug"), str) and d.get("id"):
            url = norm_url(f"/post/{d['id']}/{d['slug']}")
        date = next((d[k] for k in ("published", "publishedAt", "datePublished", "date", "published_at") if isinstance(d.get(k), str)), None)
        title = clean(title) if isinstance(title, str) else ""
        if url and len(title) >= 20:
            out.append({"title": title, "url": url, "date": date})
    return out

def strategies(page):
    m = re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', page, re.S)
    if m:
        try:
            yield "next-data", from_objects(walk(json.loads(m.group(1))))
        except ValueError:
            pass
    ld = []
    for m in re.finditer(r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>', page, re.S):
        try:
            ld.extend(walk(json.loads(m.group(1))))
        except ValueError:
            pass
    yield "json-ld", from_objects(ld)
    links = []
    for m in re.finditer(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', page, re.S):
        url, title = norm_url(html.unescape(m.group(1))), clean(m.group(2))
        if url and len(title) >= 25:
            links.append({"title": title, "url": url, "date": None})
    yield "links", links

def dedupe(items):
    seen, out = set(), []
    for it in items:
        if it["url"] not in seen:
            seen.add(it["url"]); out.append(it)
    return out

def main():
    try:
        page = fetch(AUTHOR_URL)
    except Exception as e:
        print(f"fetch failed: {e}")
        return 1
    print(f"fetched {len(page):,} bytes; title: {clean((re.search(r'<title>(.*?)</title>', page, re.S) or [None,''])[1])[:80]!r}")
    for name, items in strategies(page):
        items = dedupe(items)
        print(f"  {name}: {len(items)} candidate stories")
        if len(items) >= MIN_ITEMS:
            if any(i["date"] for i in items):
                items.sort(key=lambda i: i["date"] or "", reverse=True)
            items = items[:MAX_ITEMS]
            for i in items:
                print(f"    - {i['title'][:90]}")
            data = {"source": AUTHOR_URL, "strategy": name,
                    "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "items": [{"title": i["title"], "url": i["url"]} for i in items]}
            try:
                old = json.load(open(OUT))
                if old.get("items") == data["items"]:
                    print("no change")
                    return 0
            except (OSError, ValueError):
                pass
            json.dump(data, open(OUT, "w"), indent=2, ensure_ascii=False)
            open(OUT, "a").write("\n")
            print(f"wrote {OUT}")
            return 0
    print("no strategy found enough stories; leaving bylines.json untouched")
    print("page sample:", re.sub(r"\s+", " ", page[:1500]))
    return 1

if __name__ == "__main__":
    sys.exit(main())
