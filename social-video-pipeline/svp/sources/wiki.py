"""Pomocné funkce pro Wikipedii a Wikimedia Commons."""

import html
import re
import urllib.parse

from svp import http

COMMONS_API = "https://commons.wikimedia.org/w/api.php"


def wiki_api(lang):
    return f"https://{lang}.wikipedia.org/w/api.php"


def strip_html(text):
    return html.unescape(re.sub(r"<[^>]+>", "", text or "")).strip()


def commons_filename(url):
    """Z URL obrázku (Special:FilePath nebo upload.wikimedia.org) vytáhne název souboru."""
    path = urllib.parse.unquote(urllib.parse.urlparse(url).path)
    if "Special:FilePath/" in path:
        return path.split("Special:FilePath/", 1)[1]
    parts = path.split("/")
    # Náhledy: .../thumb/a/ab/Nazev.jpg/1280px-Nazev.jpg → bereme předposlední část
    if "/thumb/" in path and len(parts) >= 2:
        return parts[-2]
    return parts[-1]


def parse_imageinfo(data):
    """Z odpovědi Commons API vrátí {thumb_url, artist, license, license_url, file_page}."""
    pages = (data.get("query") or {}).get("pages") or {}
    for page in pages.values():
        infos = page.get("imageinfo") or []
        if not infos:
            continue
        info = infos[0]
        meta = info.get("extmetadata") or {}
        return {
            "thumb_url": info.get("thumburl") or info.get("url", ""),
            "artist": strip_html((meta.get("Artist") or {}).get("value", "")) or "neznámý autor",
            "license": (meta.get("LicenseShortName") or {}).get("value", ""),
            "license_url": (meta.get("LicenseUrl") or {}).get("value", ""),
            "file_page": info.get("descriptionurl", ""),
        }
    return None


def image_info(filename, width=1280):
    """Náhled v dané šířce + autor a licence (nutné uvést u videa)."""
    data = http.get_json(COMMONS_API, {
        "action": "query",
        "format": "json",
        "titles": f"File:{filename}",
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": width,
    })
    return parse_imageinfo(data)


def parse_extracts(data):
    """{title: plaintext úvod článku} z odpovědi prop=extracts."""
    out = {}
    pages = (data.get("query") or {}).get("pages") or {}
    for page in pages.values():
        if "extract" in page:
            out[page["title"]] = page["extract"].strip()
    return out


def extracts(titles, lang="cs"):
    """Úvodní odstavce článků. API vrací max. 20 úvodů na požadavek."""
    out = {}
    titles = list(titles)
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        data = http.get_json(wiki_api(lang), {
            "action": "query",
            "format": "json",
            "prop": "extracts",
            "exintro": 1,
            "explaintext": 1,
            "redirects": 1,
            "titles": "|".join(chunk),
        })
        out.update(parse_extracts(data))
    return out


ABBREV_RE = re.compile(r"(?:^|\s)(?:sv|tzv|např|resp|tj|č|st|stol|hl|kr|n|př|Kr|mj|aj|atd)\.$")


def first_sentences(text, n=2, max_chars=320):
    """Prvních n vět – jednoduché dělení, které nerozbije zkratky typu „r.“ nebo „sv.“."""
    text = re.sub(r"\s*\([^)]*\)", "", text)  # závorky (výslovnost, data) do videa nepatří
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.!?])\s+(?=[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ])", text)
    sentences = []
    for part in parts:
        # „sv. Václav“, „tzv. Hrad“… nejsou konce vět – spojíme zpět
        if sentences and ABBREV_RE.search(sentences[-1]):
            sentences[-1] = f"{sentences[-1]} {part}"
        else:
            sentences.append(part)
    result = ""
    for s in sentences[:n]:
        if result and len(result) + len(s) > max_chars:
            break
        result = f"{result} {s}".strip()
    return result
