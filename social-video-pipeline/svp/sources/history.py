"""Formát „Den v historii“ – co se stalo v tento den, s obrázkem a ověřeným textem.

Pro češtinu parsujeme stránku dne na cs.wikipedia (např. „9. říjen“), protože má
zvlášť sekci „Česko“ – to je pro české publikum nejzajímavější. Pro ostatní jazyky
použijeme oficiální feed „On this day“.
"""

import random
import re

from svp import http
from svp.models import Item
from svp.sources import wiki

CS_MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec",
             "srpen", "září", "říjen", "listopad", "prosinec"]

# 2. pád – „9. října“
CS_MONTHS_GEN = ["ledna", "února", "března", "dubna", "května", "června", "července",
                 "srpna", "září", "října", "listopadu", "prosince"]

LINK_RE = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")


def cs_day_title(month, day):
    return f"{day}. {CS_MONTHS[month - 1]}"


def cs_date(month, day):
    return f"{day}. {CS_MONTHS_GEN[month - 1]}"


def wikitext_to_plain(text):
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = LINK_RE.sub(lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"'{2,}", "", text)
    text = wiki.strip_html(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_cs_day(wikitext):
    """Ze stránky dne vytáhne události: [{year, text, links, region}].

    region = název podsekce v „Události“ (typicky „Česko“ nebo „Svět“)."""
    events = []
    in_events = False
    region = ""
    for line in wikitext.splitlines():
        heading = re.match(r"^(=+)\s*(.*?)\s*\1\s*$", line)
        if heading:
            level, name = len(heading.group(1)), heading.group(2)
            if level == 2:
                in_events = name.lower().startswith("událost")
                region = ""
            elif in_events:
                region = name
            continue
        if not in_events:
            continue
        m = re.match(r"^\*+\s*(?:\[\[)?(\d{1,4})(?:\]\])?\s*(?:př\.\s*n\.\s*l\.)?\s*[–—-]\s*(.+)$", line)
        if not m:
            continue
        year, body = int(m.group(1)), m.group(2)
        links = [l.group(1).strip() for l in LINK_RE.finditer(body)]
        links = [l for l in links if not re.fullmatch(r"\d{1,4}", l) and ":" not in l]
        events.append({
            "year": year,
            "text": wikitext_to_plain(body),
            "links": links,
            "region": region,
        })
    return events


def parse_feed(data):
    """Feed „onthisday/events“ → stejný tvar jako parse_cs_day, jen s hotovými obrázky."""
    events = []
    for ev in data.get("events", []):
        page = next((p for p in ev.get("pages", []) if p.get("originalimage")), None)
        events.append({
            "year": ev.get("year"),
            "text": ev.get("text", ""),
            "links": [p["titles"]["normalized"] for p in ev.get("pages", []) if "titles" in p],
            "region": "",
            "image": (page or {}).get("originalimage", {}).get("source", ""),
            "extract": (page or {}).get("extract", ""),
            "page_url": ((page or {}).get("content_urls") or {}).get("desktop", {}).get("page", ""),
        })
    return events


def parse_pageinfo(data):
    """prop=pageimages|extracts|info → {title: {image_name, original, extract, url}}"""
    out = {}
    query = data.get("query") or {}
    redirects = {r["from"]: r["to"] for r in query.get("redirects", []) + query.get("normalized", [])}
    for page in (query.get("pages") or {}).values():
        out[page.get("title")] = {
            "image_name": page.get("pageimage", ""),
            "original": (page.get("original") or {}).get("source", ""),
            "extract": page.get("extract", ""),
            "url": page.get("fullurl", ""),
        }
    for src, dst in redirects.items():
        if dst in out:
            out[src] = out[dst]
    return out


def page_info(titles, lang):
    out = {}
    titles = list(dict.fromkeys(titles))
    for i in range(0, len(titles), 20):
        data = http.get_json(wiki.wiki_api(lang), {
            "action": "query",
            "format": "json",
            "prop": "pageimages|extracts|info",
            "piprop": "original|name",
            "exintro": 1,
            "explaintext": 1,
            "inprop": "url",
            "redirects": 1,
            "titles": "|".join(titles[i:i + 20]),
        })
        out.update(parse_pageinfo(data))
    return out


def pick_events(events, count, prefer_region="Česko", seed=None):
    """Vybere události rozprostřené napříč staletími, přednostně z preferované sekce;
    výsledek je seřazený chronologicky (ve videu to plyne přirozeněji)."""
    rng = random.Random(seed)
    preferred = [e for e in events if prefer_region and e["region"].startswith(prefer_region)]
    rest = [e for e in events if e not in preferred]
    rng.shuffle(preferred)
    rng.shuffle(rest)
    chosen, centuries = [], set()

    def take(pool, diverse):
        for e in pool:
            if len(chosen) >= count:
                return
            if e in chosen or (diverse and e["year"] // 100 in centuries):
                continue
            chosen.append(e)
            centuries.add(e["year"] // 100)

    # preferovaná sekce má přednost; v rámci každé skupiny nejdřív max. 1 událost
    # na století, aby video nebylo jen o 20. století
    for pool in (preferred, rest):
        take(pool, diverse=True)
        take(pool, diverse=False)
    return sorted(chosen, key=lambda e: e["year"])


def _cs_events(month, day):
    data = http.get_json(wiki.wiki_api("cs"), {
        "action": "parse",
        "format": "json",
        "prop": "wikitext",
        "formatversion": 2,
        "page": cs_day_title(month, day),
    })
    return parse_cs_day(data["parse"]["wikitext"])


def _feed_events(month, day, lang):
    url = f"https://{lang}.wikipedia.org/api/rest_v1/feed/onthisday/events/{month:02d}/{day:02d}"
    return parse_feed(http.get_json(url))


def fetch(month, day, count=5, lang="cs", prefer_region="Česko", seed=None):
    events = _cs_events(month, day) if lang == "cs" else _feed_events(month, day, lang)
    if lang == "cs":
        # obrázek a text bereme z hlavního odkazovaného článku (první nečíselný odkaz)
        info = page_info([e["links"][0] for e in events if e["links"]], lang)
        for e in events:
            page = info.get(e["links"][0], {}) if e["links"] else {}
            e["image"] = page.get("original", "")
            e["image_name"] = page.get("image_name", "")
            e["extract"] = page.get("extract", "")
            e["page_url"] = page.get("url", "")

    with_image = [e for e in events if e.get("image")]
    items = []
    for e in pick_events(with_image, count, prefer_region if lang == "cs" else None, seed):
        filename = e.get("image_name") or wiki.commons_filename(e["image"])
        try:
            credit = wiki.image_info(filename) or {}
        except Exception:  # soubor může být jen lokálně na Wikipedii, ne na Commons
            credit = {}
        context = wiki.first_sentences(e.get("extract", ""), n=2)
        items.append(Item(
            id=f"{e['year']}-{(e['links'] or ['udalost'])[0]}",
            title=f"{e['year']}: {(e['links'] or [''])[0]}".strip(": "),
            facts=f"{e['text']}\n\n{context}".strip(),
            image_url=credit.get("thumb_url") or e["image"],
            source_url=e.get("page_url", ""),
            year=e["year"],
            credit=credit,
        ))
    return items
