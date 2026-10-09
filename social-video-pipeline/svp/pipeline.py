"""Celý běh: zdroj → scénář → obrázky 9:16 → klipy → balíček pro MoneyPrinterTurbo."""

import datetime as dt
import json
import os
import re
import unicodedata

from svp import http, media, mpt, script as scriptmod
from svp.models import Item

MIN_SEGMENT_SECONDS = 4.0


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "video"


def segment_seconds(script):
    """Odhad délky komentáře nad každým klipem (hook patří k prvnímu, outro k poslednímu)."""
    secs = [scriptmod.estimate_seconds(s["narration"]) for s in script["segments"]]
    secs[0] += scriptmod.estimate_seconds(script["hook"])
    secs[-1] += scriptmod.estimate_seconds(script["outro"])
    # rezerva na pauzy mezi větami, ať video neskončí dřív než hlas
    return [max(MIN_SEGMENT_SECONDS, s * 1.1 + 0.5) for s in secs]


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def write_credits(path, items, script):
    """Popisek + zdroje a licence fotek – CC BY(-SA) vyžaduje uvést autora."""
    lines = [script.get("description", script["title"]), "", " ".join(script.get("hashtags", [])),
             "", "Zdroje: Wikipedie, Wikidata, Wikimedia Commons"]
    for item in items:
        c = item.credit or {}
        lic = c.get("license") or "licence neuvedena – ověř ručně"
        lines.append(f"- {item.title}: foto {c.get('artist', 'neznámý autor')}, {lic}"
                     f"{' ' + c['file_page'] if c.get('file_page') else ''}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def run(fmt, items, out_root, context="", motion="kenburns", fit="blur",
        llm=True, llm_model="qwen2.5:14b", ollama_host="http://127.0.0.1:11434",
        comfy_host="http://127.0.0.1:8188", comfy_workflow=None, comfy_map=None,
        mpt_dir=None, mpt_host=None, voice="cs-CZ-AntoninNeural-Male", log=print):
    if not items:
        raise ValueError("Zdroj nevrátil žádné položky.")

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    job = f"{stamp}-{fmt}-{slugify(context or items[0].title)}"
    out = os.path.join(out_root, job)
    for sub in ("raw", "images", "clips"):
        os.makedirs(os.path.join(out, sub), exist_ok=True)
    log(f"→ Výstup: {out}")

    # 1) Obrázky
    for n, item in enumerate(items, 1):
        raw = os.path.join(out, "raw", f"{n:02d}.jpg")
        http.download(item.image_url, raw)
        item.image_path = media.prepare_image(raw, os.path.join(out, "images", f"{n:02d}.jpg"), fit=fit)
        log(f"  obrázek {n}/{len(items)}: {item.title}")

    # 2) Scénář
    script = scriptmod.generate(fmt, items, context, use_llm=llm, model=llm_model,
                                host=ollama_host, log=log)
    narration = scriptmod.full_narration(script)
    seconds = segment_seconds(script)
    write_json(os.path.join(out, "script.json"), script)
    with open(os.path.join(out, "narration.txt"), "w", encoding="utf-8") as f:
        f.write(narration + "\n")
    log(f"  scénář ({script['generator']}): ~{sum(seconds):.0f} s")

    # 3) Klipy
    jobs = []
    workflow = mapping = None
    if motion == "ltx":
        from svp import ltx
        with open(comfy_workflow, encoding="utf-8") as f:
            workflow = json.load(f)
        mapping = ltx.load_map(comfy_map)
    for n, (item, seg, secs) in enumerate(zip(items, script["segments"], seconds), 1):
        clip = os.path.join(out, "clips", f"{n:02d}.mp4")
        jobs.append({"image": item.image_path, "prompt": seg["motion_prompt"], "seconds": round(secs, 1),
                     "clip": clip})
        if motion == "kenburns":
            media.kenburns_clip(item.image_path, clip, seconds=secs, zoom_in=n % 2 == 1)
        elif motion == "ltx":
            from svp import ltx
            raw_clip = os.path.join(out, "clips", f"{n:02d}-ltx.mp4")
            ltx.generate_clip(comfy_host, workflow, mapping, item.image_path, seg["motion_prompt"], raw_clip)
            media.fit_clip_length(raw_clip, clip, secs)
        else:  # "none" – jen připravit úlohy, klipy vyrobíš ručně
            continue
        item.clip_path = clip
        log(f"  klip {n}/{len(items)} ({motion}, {secs:.1f} s)")
    write_json(os.path.join(out, "ltx_jobs.json"), jobs)
    write_json(os.path.join(out, "items.json"), [i.to_dict() for i in items])
    write_credits(os.path.join(out, "popisek_a_zdroje.txt"), items, script)

    # 4) MoneyPrinterTurbo
    clips = [i.clip_path for i in items if i.clip_path]
    if len(clips) == len(items):
        paths = mpt.install_clips(clips, mpt_dir, job) if mpt_dir else [os.path.abspath(c) for c in clips]
        request = mpt.build_request(script, narration, paths, seconds, voice=voice)
        write_json(os.path.join(out, "mpt_request.json"), request)
        if mpt_host:
            resp = mpt.submit(request, mpt_host)
            log(f"  MoneyPrinterTurbo úloha: {resp}")
    return out
