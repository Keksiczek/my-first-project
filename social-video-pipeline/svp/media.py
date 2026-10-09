"""Obrázky a klipy přes ffmpeg: ořez na 9:16 a Ken Burns pohyb (záloha bez GPU)."""

import subprocess

# 768×1344 = 9:16, obě strany dělitelné 32 → přímo použitelné pro LTX-Video.
WIDTH, HEIGHT = 768, 1344


def run_ffmpeg(args):
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg selhal: {proc.stderr.strip()}")


def prepare_image(src, dest, fit="blur", width=WIDTH, height=HEIGHT):
    """Převede libovolnou fotku na 9:16.

    fit="blur"  – celá fotka uprostřed, pozadí rozmazaná zvětšená kopie (hodí se na
                  památky na šířku, nic se neuřízne)
    fit="cover" – ořez na střed přes celou plochu
    """
    if fit == "cover":
        vf = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
              f"crop={width}:{height},setsar=1")
    else:
        vf = (f"split[a][b];"
              f"[a]scale={width}:{height}:force_original_aspect_ratio=increase,"
              f"crop={width}:{height},boxblur=24:2,eq=brightness=-0.08[bg];"
              f"[b]scale={width}:{height}:force_original_aspect_ratio=decrease[fg];"
              f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1")
    run_ffmpeg(["-i", src, "-vf", vf, "-frames:v", "1", "-q:v", "2", dest])
    return dest


def kenburns_clip(image, dest, seconds=5.0, fps=30, zoom_in=True,
                  width=1080, height=1920):
    """Plynulý zoom + lehký posun – rychlá náhrada LTX, když není GPU."""
    frames = int(seconds * fps)
    z = f"1+0.12*on/{frames}" if zoom_in else f"1.12-0.12*on/{frames}"
    # Obrázek nejdřív zvětšíme 2×, aby zoompan nezubatěl
    vf = (f"scale={width * 2}:{height * 2},"
          f"zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+on*0.15':"
          f"d={frames}:s={width}x{height}:fps={fps},"
          f"format=yuv420p")
    run_ffmpeg(["-loop", "1", "-i", image, "-vf", vf, "-t", f"{seconds}",
                "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-an", dest])
    return dest


def probe_duration(path):
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", path],
        capture_output=True, text=True, check=True)
    return float(proc.stdout.strip())


def fit_clip_length(src, dest, seconds, fps=30, width=1080, height=1920):
    """Dorovná klip na délku segmentu komentáře.

    LTX dává typicky 3–5 s, mluvený segment bývá delší. Krátký klip prodloužíme
    „boomerangem“ (tam a zpět) – u pomalých průletů kamerou to nepůsobí rušivě."""
    duration = probe_duration(src)
    scale = (f"scale={width}:{height}:force_original_aspect_ratio=increase,"
             f"crop={width}:{height},fps={fps},format=yuv420p")
    if duration >= seconds:
        vf = scale
        inputs = ["-i", src]
    else:
        loops = int(seconds // (2 * duration)) + 1
        vf = (f"[0:v]{scale},split[f][b];[b]reverse[r];[f][r]concat=n=2:v=1:a=0,"
              f"loop={loops}:size={int(2 * duration * fps) + 2}:start=0")
        inputs = ["-i", src]
    run_ffmpeg([*inputs, "-filter_complex" if duration < seconds else "-vf", vf,
                "-t", f"{seconds:.2f}", "-an", "-c:v", "libx264", "-preset", "medium",
                "-crf", "20", dest])
    return dest
