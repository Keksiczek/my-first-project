"""Předání hotových klipů a scénáře do MoneyPrinterTurbo (API /api/v1/videos).

MPT se postará o hlas (edge-tts), titulky, hudbu a finální render 1080×1920.
Klipy jdou jako video_source="local" ve stejném pořadí jako segmenty scénáře.
"""

import math
import os
import shutil

from svp import http


def install_clips(clips, mpt_dir, job_name):
    """Zkopíruje klipy do <MPT>/storage/local_videos/<job>/ – novější MPT povoluje
    lokální materiály jen z této složky. Vrací cesty relativní k ní."""
    target = os.path.join(mpt_dir, "storage", "local_videos", job_name)
    os.makedirs(target, exist_ok=True)
    rel = []
    for clip in clips:
        name = os.path.basename(clip)
        shutil.copy2(clip, os.path.join(target, name))
        rel.append(f"{job_name}/{name}")
    return rel


def build_request(script, narration, material_paths, clip_seconds, voice="cs-CZ-AntoninNeural-Male",
                  voice_rate=1.0, bgm_volume=0.15, font_name="BeVietnamPro-Bold.ttf", subtitle_position="bottom"):
    params = {
        "video_subject": script["title"],
        "video_script": narration,
        "video_aspect": "9:16",
        "video_source": "local",
        "video_materials": [
            {"provider": "local", "url": p, "duration": int(math.ceil(s))}
            for p, s in zip(material_paths, clip_seconds)
        ],
        # sequential + délka ≥ nejdelší klip → každý klip se použije celý a ve správném pořadí
        "video_concat_mode": "sequential",
        "video_clip_duration": int(math.ceil(max(clip_seconds))),
        "video_count": 1,
        "video_language": "cs-CZ",
        "voice_name": voice,
        "voice_rate": voice_rate,
        "voice_volume": 1.0,
        "bgm_type": "random",
        "bgm_volume": bgm_volume,
        "subtitle_enabled": True,
        "subtitle_position": subtitle_position,
        "font_size": 60,
        "stroke_width": 1.5,
    }
    if font_name:
        params["font_name"] = font_name
    return params


def submit(params, host="http://127.0.0.1:8080"):
    return http.post_json(f"{host}/api/v1/videos", params)
