"""Formát „Místa, o kterých nevíš“ – skutečná místa z Wikidata s fotkou a článkem."""

import random
import urllib.parse

from svp import http
from svp.models import Item
from svp.sources import wiki

SPARQL_URL = "https://query.wikidata.org/sparql"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# Typy míst (QID ve Wikidata). Další se dají přidat i přes --type-qid.
PLACE_TYPES = {
    "hrad": "Q23413",
    "zricenina": "Q17715832",
    "zamek": "Q751876",
    "rozhledna": "Q1440300",
    "jeskyne": "Q35509",
    "vodopad": "Q34038",
    "klaster": "Q44613",
    "most": "Q12280",
    "hora": "Q8502",
    "jezero": "Q23397",
    "kostel": "Q16970",
    "mlyn": "Q44494",
    "kaple": "Q108325",
}

COUNTRY_CZ = "Q213"


def build_query(type_qid, region_qid, lang="cs", limit=300):
    """SPARQL: místa daného typu v regionu, která mají fotku a článek ve zvoleném jazyce."""
    return f"""
SELECT ?item ?itemLabel ?image ?coord ?article ?sitelinks WHERE {{
  ?item wdt:P31/wdt:P279* wd:{type_qid} ;
        wdt:P18 ?image ;
        wikibase:sitelinks ?sitelinks .
  {{ ?item wdt:P17 wd:{region_qid} }} UNION {{ ?item wdt:P131+ wd:{region_qid} }}
  OPTIONAL {{ ?item wdt:P625 ?coord }}
  ?article schema:about ?item ;
           schema:isPartOf <https://{lang}.wikipedia.org/> .
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "{lang},en". }}
}}
LIMIT {limit}
"""


def parse_point(wkt):
    """'Point(17.25 49.59)' → (49.59, 17.25)"""
    if not wkt or not wkt.startswith("Point("):
        return None
    lon, lat = wkt[6:-1].split()
    return (round(float(lat), 5), round(float(lon), 5))


def parse_sparql(data):
    """Odpověď SPARQL → seznam kandidátů (bez duplicit podle QID)."""
    seen = {}
    for row in data["results"]["bindings"]:
        qid = row["item"]["value"].rsplit("/", 1)[1]
        if qid in seen:
            continue
        article_url = row["article"]["value"]
        seen[qid] = {
            "qid": qid,
            "label": row["itemLabel"]["value"],
            "image": row["image"]["value"],
            "coord": parse_point(row.get("coord", {}).get("value")),
            "article_url": article_url,
            "article_title": http_unquote_title(article_url),
            "sitelinks": int(row["sitelinks"]["value"]),
        }
    return list(seen.values())


def http_unquote_title(article_url):
    return urllib.parse.unquote(article_url.rsplit("/wiki/", 1)[1]).replace("_", " ")


def resolve_region(name_or_qid, lang="cs"):
    """'Olomoucký kraj' → QID přes vyhledávání Wikidata. QID projde beze změny."""
    if not name_or_qid:
        return COUNTRY_CZ
    if name_or_qid.upper().startswith("Q") and name_or_qid[1:].isdigit():
        return name_or_qid.upper()
    data = http.get_json(WIKIDATA_API, {
        "action": "wbsearchentities",
        "format": "json",
        "language": lang,
        "uselang": lang,
        "type": "item",
        "limit": 1,
        "search": name_or_qid,
    })
    hits = data.get("search") or []
    if not hits:
        raise ValueError(f"Region '{name_or_qid}' jsem ve Wikidata nenašel – zkus zadat QID.")
    return hits[0]["id"]


def pick_candidates(candidates, count, obscure=True, seed=None):
    """„Místa, o kterých nevíš“: vynecháme nejslavnější třetinu (podle počtu jazykových verzí)
    a z velmi neznámých (1 jazyk) bereme jen když není jinak dost kandidátů."""
    rng = random.Random(seed)
    pool = sorted(candidates, key=lambda c: c["sitelinks"])
    if obscure and len(pool) >= count * 3:
        cut = int(len(pool) * 2 / 3)
        middle = [c for c in pool[:cut] if c["sitelinks"] >= 2]
        pool = middle if len(middle) >= count * 2 else pool[:cut]
    rng.shuffle(pool)
    return pool


def fetch(type_key=None, type_qid=None, region=None, count=5, lang="cs",
          obscure=True, seed=None, min_extract=250):
    type_qid = type_qid or PLACE_TYPES[type_key]
    region_qid = resolve_region(region, lang)
    data = http.get_json(
        SPARQL_URL,
        {"query": build_query(type_qid, region_qid, lang), "format": "json"},
        headers={"Accept": "application/sparql-results+json"},
        timeout=90,
    )
    candidates = pick_candidates(parse_sparql(data), count, obscure, seed)
    if not candidates:
        raise ValueError("Wikidata nevrátila žádná místa – zkus jiný typ nebo větší region.")

    items = []
    # Úvody stahujeme po dávkách, dokud nemáme dost míst s dostatečně dlouhým textem
    for i in range(0, len(candidates), 20):
        batch = candidates[i:i + 20]
        texts = wiki.extracts([c["article_title"] for c in batch], lang)
        for c in batch:
            text = texts.get(c["article_title"], "")
            if len(text) < min_extract:
                continue
            credit = wiki.image_info(wiki.commons_filename(c["image"])) or {}
            items.append(Item(
                id=c["qid"],
                title=c["label"],
                facts=text,
                image_url=credit.get("thumb_url") or c["image"],
                source_url=c["article_url"],
                coord=c["coord"],
                credit=credit,
            ))
            if len(items) >= count:
                return items
    return items
