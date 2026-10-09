"""Scénář: lokální LLM (Ollama) přepíše ověřená fakta do krátkého mluveného textu.

Bez Ollamy (nebo když odpověď neprojde kontrolou) se použije šablona přímo
z textu Wikipedie – pipeline tak funguje vždy.
"""

import json
import re

from svp import http
from svp.sources.wiki import first_sentences

# Přibližná rychlost české TTS (edge-tts Antonín/Vlasta) ve znacích za sekundu.
CHARS_PER_SECOND = 14.0

FORMATS = {
    "places": {
        "hook": "{n} míst, o kterých jste nejspíš nikdy neslyšeli.",
        "outro": "Které z nich byste navštívili? Napište do komentářů.",
        "motion": "slow cinematic drone push-in towards {title}, gentle parallax, soft natural light, "
                  "subtle atmospheric haze, realistic, steady camera",
        "brief": "Formát „Místa, o kterých nevíš“: skutečná, méně známá místa. Tón: zvědavý, "
                 "lehce tajemný, ale věcný.",
    },
    "history": {
        "hook": "Co se stalo {date}? Tohle vás možná překvapí.",
        "outro": "Kterou z těchto událostí jste znali? Sledujte pro další den v historii.",
        "motion": "slow ken burns zoom on a historical scene of {title}, subtle film grain, "
                  "gentle camera drift, archival documentary style",
        "brief": "Formát „Den v historii“: události, které se staly v tento den. Tón: "
                 "dokumentární, poutavý, každá událost začíná rokem.",
    },
}

SYSTEM_PROMPT = """Jsi scenárista krátkých vertikálních videí (TikTok, Reels, Shorts) v češtině.
Píšeš text pro hlasový komentář. Pravidla:
- Používej VÝHRADNĚ fakta z dodaných podkladů. Nic si nevymýšlej, nepřidávej čísla, data ani jména, která v podkladech nejsou.
- Každý segment: 2 krátké věty, maximálně 40 slov, přirozená mluvená čeština, bez závorek a zkratek.
- Hook: jedna úderná věta do 12 slov.
- motion_prompt: anglicky, 1 věta pro image-to-video model – popis pohybu kamery a atmosféry odpovídající danému obrázku. Žádné nové objekty, žádný text.
- Odpověz pouze JSON objektem."""

SCHEMA_HINT = """{
  "title": "krátký titulek videa",
  "hook": "úvodní věta",
  "segments": [{"item_id": "...", "narration": "...", "on_screen": "2–4 slova na obrazovku", "motion_prompt": "..."}],
  "outro": "závěrečná výzva",
  "hashtags": ["#..."],
  "description": "popisek pod video, 1–2 věty"
}"""


def _item_brief(item):
    year = f" (rok {item.year})" if item.year else ""
    return f"- item_id: {item.id}\n  název: {item.title}{year}\n  podklady: {first_sentences(item.facts, n=4, max_chars=700)}"


def build_prompt(fmt, items, context=""):
    spec = FORMATS[fmt]
    briefs = "\n".join(_item_brief(i) for i in items)
    return (
        f"{spec['brief']}\n{context}\n\n"
        f"Napiš scénář s jedním segmentem pro každou položku, ve stejném pořadí.\n\n"
        f"Podklady:\n{briefs}\n\nVrať JSON v tomto tvaru:\n{SCHEMA_HINT}"
    )


def template_script(fmt, items, context=""):
    spec = FORMATS[fmt]
    segments = []
    for item in items:
        narration = first_sentences(item.facts, n=2)
        if fmt == "history" and item.year and not narration.startswith(str(item.year)):
            narration = f"Roku {item.year}. {narration}"
        segments.append({
            "item_id": item.id,
            "narration": narration,
            "on_screen": item.title,
            "motion_prompt": spec["motion"].format(title=item.title),
        })
    title = spec["hook"].format(n=len(items), date=context).rstrip(".?")
    return {
        "title": title,
        "hook": spec["hook"].format(n=len(items), date=context),
        "segments": segments,
        "outro": spec["outro"],
        "hashtags": ["#zajimavosti", "#cesko", "#historie" if fmt == "history" else "#vylet"],
        "description": title,
        "generator": "template",
    }


def validate(script, items):
    """Zkontroluje, že LLM vrátilo segment pro každou položku a nic nepřidalo."""
    if not isinstance(script, dict) or not isinstance(script.get("segments"), list):
        return False
    ids = [s.get("item_id") for s in script["segments"]]
    if ids != [i.id for i in items]:
        return False
    for seg in script["segments"]:
        if not seg.get("narration") or len(seg["narration"].split()) > 60:
            return False
    return bool(script.get("hook"))


def extract_json(text):
    """Ollama občas obalí JSON do ```json ... ``` – vytáhneme samotný objekt."""
    m = re.search(r"\{.*\}", text, flags=re.S)
    return json.loads(m.group(0)) if m else None


def ollama_script(fmt, items, context="", model="qwen2.5:14b",
                  host="http://127.0.0.1:11434"):
    resp = http.post_json(f"{host}/api/generate", {
        "model": model,
        "system": SYSTEM_PROMPT,
        "prompt": build_prompt(fmt, items, context),
        "format": "json",
        "stream": False,
        "options": {"temperature": 0.6},
    }, timeout=600)
    return extract_json(resp.get("response", ""))


def generate(fmt, items, context="", use_llm=True, model="qwen2.5:14b",
             host="http://127.0.0.1:11434", log=print):
    if use_llm:
        try:
            script = ollama_script(fmt, items, context, model, host)
            if validate(script, items):
                script["generator"] = f"ollama:{model}"
                return script
            log("! Odpověď LLM neprošla kontrolou – používám šablonu.")
        except Exception as err:  # Ollama neběží, model chybí…
            log(f"! Ollama nedostupná ({err}) – používám šablonu.")
    return template_script(fmt, items, context)


def full_narration(script):
    parts = [script["hook"]] + [s["narration"] for s in script["segments"]] + [script["outro"]]
    return "\n".join(p.strip() for p in parts if p and p.strip())


def estimate_seconds(text):
    return len(text) / CHARS_PER_SECOND
