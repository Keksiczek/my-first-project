"""CLI:  python -m svp places --type hrad --region "Olomoucký kraj"
        python -m svp history --date 10-09
"""

import argparse
import datetime as dt
import sys

from svp import pipeline
from svp.sources import history, places


def common_args(p):
    p.add_argument("--count", type=int, default=5, help="počet záběrů (default 5)")
    p.add_argument("--seed", type=int, help="pro opakovatelný výběr")
    p.add_argument("--out", default="output", help="kořenová složka výstupů")
    p.add_argument("--motion", choices=["kenburns", "ltx", "none"], default="kenburns",
                   help="kenburns = ffmpeg bez GPU, ltx = ComfyUI workflow, none = jen úlohy")
    p.add_argument("--fit", choices=["blur", "cover"], default="blur")
    p.add_argument("--no-llm", action="store_true", help="scénář jen ze šablony (bez Ollamy)")
    p.add_argument("--llm-model", default="qwen2.5:14b")
    p.add_argument("--ollama", default="http://127.0.0.1:11434")
    p.add_argument("--comfy", default="http://127.0.0.1:8188")
    p.add_argument("--comfy-workflow", default="comfy/ltx_i2v_api.json")
    p.add_argument("--comfy-map", default="comfy/ltx_map.json")
    p.add_argument("--mpt-dir", help="složka tvého MoneyPrinterTurbo (klipy se zkopírují do storage/local_videos)")
    p.add_argument("--mpt", help="URL API MoneyPrinterTurbo, např. http://127.0.0.1:8080 – rovnou odešle úlohu")
    p.add_argument("--voice", default="cs-CZ-AntoninNeural-Male")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="svp", description="Nové formáty videí pro sociální sítě")
    sub = ap.add_subparsers(dest="format", required=True)

    pp = sub.add_parser("places", help="Místa, o kterých nevíš")
    pp.add_argument("--type", choices=sorted(places.PLACE_TYPES), default="zricenina")
    pp.add_argument("--type-qid", help="vlastní typ místa jako QID (přebije --type)")
    pp.add_argument("--region", default="Česko", help="název regionu nebo QID")
    pp.add_argument("--famous", action="store_true", help="nevynechávat nejznámější místa")
    common_args(pp)

    hp = sub.add_parser("history", help="Den v historii")
    hp.add_argument("--date", help="MM-DD, výchozí je dnešek")
    hp.add_argument("--lang", default="cs")
    hp.add_argument("--prefer", default="Česko", help="preferovaná sekce stránky dne (cs)")
    common_args(hp)

    a = ap.parse_args(argv)

    if a.format == "places":
        items = places.fetch(a.type, a.type_qid, a.region, a.count, obscure=not a.famous, seed=a.seed)
        context = f"{a.type_qid or a.type} – {a.region}"
    else:
        today = dt.date.today()
        month, day = (map(int, a.date.split("-")) if a.date else (today.month, today.day))
        items = history.fetch(month, day, a.count, a.lang, a.prefer, a.seed)
        context = history.cs_date(month, day)

    out = pipeline.run(
        "places" if a.format == "places" else "history", items, a.out, context=context,
        motion=a.motion, fit=a.fit, llm=not a.no_llm, llm_model=a.llm_model,
        ollama_host=a.ollama, comfy_host=a.comfy, comfy_workflow=a.comfy_workflow,
        comfy_map=a.comfy_map, mpt_dir=a.mpt_dir, mpt_host=a.mpt, voice=a.voice)
    print(f"Hotovo: {out}")


if __name__ == "__main__":
    sys.exit(main())
