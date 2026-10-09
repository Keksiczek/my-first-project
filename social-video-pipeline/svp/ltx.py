"""Napojení na LTX-Video přes ComfyUI API.

Použije TVŮJ workflow: v ComfyUI ho ulož přes „Export (API)“ a do souboru
comfy/ltx_map.json zapiš id uzlů, kam se má dosadit obrázek, prompt a seed.
Pipeline pak pro každý záběr nahraje obrázek, spustí workflow a stáhne video.
"""

import copy
import json
import os
import random
import time
import urllib.parse
import urllib.request
import uuid

from svp import http

DEFAULT_NEGATIVE = ("text, watermark, logo, subtitles, distorted, morphing, warped architecture, "
                    "extra objects, low quality, blurry, jittery camera")


def load_map(path):
    """ltx_map.json – kam v API workflow dosadit vstupy, např.:
    {"image": ["12", "image"], "prompt": ["6", "text"], "negative": ["7", "text"],
     "seed": ["25", "noise_seed"], "frames": ["38", "length"]}"""
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def fill_workflow(workflow, mapping, image_name, prompt, negative=DEFAULT_NEGATIVE,
                  seed=None, frames=None):
    wf = copy.deepcopy(workflow)

    def put(key, value):
        if key not in mapping or value is None:
            return
        node_id, field = mapping[key]
        if node_id not in wf:
            raise KeyError(f"Uzel {node_id} ({key}) ve workflow neexistuje – zkontroluj ltx_map.json")
        wf[node_id]["inputs"][field] = value

    put("image", image_name)
    put("prompt", prompt)
    put("negative", negative)
    put("seed", seed if seed is not None else random.randint(0, 2**31 - 1))
    put("frames", frames)
    return wf


def _upload_image(host, path):
    """multipart/form-data upload do ComfyUI (/upload/image) bez externích knihoven."""
    boundary = uuid.uuid4().hex
    name = os.path.basename(path)
    with open(path, "rb") as f:
        content = f.read()
    body = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"image\"; filename=\"{name}\"\r\n"
        f"Content-Type: image/jpeg\r\n\r\n").encode() + content + (
        f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue"
        f"\r\n--{boundary}--\r\n").encode()
    req = urllib.request.Request(
        f"{host}/upload/image", data=body, method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())["name"]


def _find_video(outputs):
    """Najde výstupní video v historii ComfyUI (VHS_VideoCombine dává 'gifs',
    SaveVideo/SaveAnimatedWEBP 'images' nebo 'videos')."""
    for node_out in outputs.values():
        for key in ("gifs", "videos", "images"):
            for f in node_out.get(key, []):
                if f.get("filename", "").lower().endswith((".mp4", ".webm", ".mov", ".webp", ".gif")):
                    return f
    return None


def generate_clip(host, workflow, mapping, image_path, prompt, dest,
                  seed=None, frames=None, timeout=1800, poll=3):
    image_name = _upload_image(host, image_path)
    wf = fill_workflow(workflow, mapping, image_name, prompt, seed=seed, frames=frames)
    prompt_id = http.post_json(f"{host}/prompt", {"prompt": wf, "client_id": "svp"})["prompt_id"]

    deadline = time.time() + timeout
    while time.time() < deadline:
        hist = http.get_json(f"{host}/history/{prompt_id}")
        if prompt_id in hist:
            entry = hist[prompt_id]
            status = entry.get("status", {})
            if status.get("status_str") == "error":
                raise RuntimeError(f"ComfyUI chyba: {status.get('messages')}")
            video = _find_video(entry.get("outputs", {}))
            if video:
                q = urllib.parse.urlencode({k: video.get(k, "") for k in ("filename", "subfolder", "type")})
                return http.download(f"{host}/view?{q}", dest, timeout=300)
            if status.get("completed"):
                raise RuntimeError("Workflow doběhl, ale nenašel jsem výstupní video – "
                                   "přidej do workflow uzel, který video ukládá.")
        time.sleep(poll)
    raise TimeoutError(f"LTX klip nedoběhl do {timeout} s")
