# Social Video Pipeline

Dva nové formáty krátkých videí na výšku (TikTok / Reels / Shorts). Napojují se na tvůj stávající
stack: **LTX-Video** (obrázek → video) přes ComfyUI a **MoneyPrinterTurbo** (hlas, titulky, hudba, render).

| Formát | Příkaz | Zdroj faktů a obrázků |
|---|---|---|
| **Místa, o kterých nevíš** | `python -m svp places` | Wikidata (skutečná místa) + úvod článku z cs.wikipedia + fotka z Commons |
| **Den v historii** | `python -m svp history` | stránka dne na cs.wikipedia (sekce „Česko“ má přednost) + obrázek z článku |

Fakta se nevymýšlí: LLM jen přepisuje text z Wikipedie a výstup se kontroluje. Když neprojde,
použije se šablona přímo z textu článku.

## Jak to běží

```
zdroj (Wikidata / Wikipedie)
  → fotky upravené na 9:16 (768×1344, rovnou pro LTX)
  → scénář (Ollama, jinak šablona)
  → klipy: LTX přes ComfyUI  |  Ken Burns přes ffmpeg (bez GPU)
  → klipy dorovnané na délku mluveného segmentu
  → MoneyPrinterTurbo (video_source=local, sequential) → hotové video 1080×1920
```

## Instalace

Stačí Python 3.10+ a `ffmpeg` v PATH. Žádné pip balíčky nejsou potřeba.

Volitelně:
- **Ollama** s modelem, který umí česky, např. `ollama pull qwen2.5:14b`. Na 16 GB se vejde vedle sebe s ComfyUI,
  ale bezpečnější je mít ji při generování LTX vypnutou (`--no-llm`), nebo nejdřív udělat scénář a pak klipy.
- **ComfyUI** s tvým LTX image-to-video workflow.
- **MoneyPrinterTurbo** (tvůj fork) spuštěný jako API (`python main.py`, port 8080).

## Rychlý start

```bash
# 1) Bez GPU: ověří zdroje dat, scénář a balíček pro MPT (klipy Ken Burns)
python -m svp places --type zricenina --region "Olomoucký kraj" --count 5 --no-llm

# 2) Den v historii pro dnešek / konkrétní den
python -m svp history --date 10-28 --count 5

# 3) Naostro: LTX klipy + odeslání do MoneyPrinterTurbo
python -m svp places --type hrad --region "Jihočeský kraj" \
    --motion ltx --comfy-workflow comfy/ltx_i2v_api.json --comfy-map comfy/ltx_map.json \
    --mpt-dir ~/MoneyPrinterTurbo --mpt http://127.0.0.1:8080
```

Typy míst: `hrad, zricenina, zamek, rozhledna, jeskyne, vodopad, klaster, most, hora, jezero, kostel, mlyn, kaple`.
Jakýkoli jiný typ zadáš přes `--type-qid Q…` (QID z wikidata.org). Region může být název („Šumava“,
„okres Jeseník“) nebo QID. Výchozí výběr vynechává nejslavnější třetinu míst; s `--famous` je zahrne.

## Napojení na tvůj LTX workflow

1. V ComfyUI otevři svůj LTX i2v workflow → **Export (API)** → ulož jako `comfy/ltx_i2v_api.json`.
2. Zkopíruj `comfy/ltx_map.example.json` na `comfy/ltx_map.json` a doplň id uzlů:
   - `image`: uzel **LoadImage**, vstup `image`
   - `prompt` / `negative`: uzly **CLIPTextEncode**, vstup `text`
   - `seed`: sampler / RandomNoise (`seed` nebo `noise_seed`)
   - `frames` (volitelné): délka (`length`), např. 97 snímků ≈ 4 s při 24 fps
3. Workflow musí končit uzlem, který ukládá video (VHS Video Combine nebo SaveVideo).

Každý záběr dostane od LLM vlastní `motion_prompt` (anglicky, pohyb kamery). Kratší LTX klip se
prodlouží „boomerangem“ na délku komentáře. S `--motion none` se jen připraví `ltx_jobs.json`
(obrázek + prompt + délka) pro ruční nebo dávkové zpracování.

## Výstup (`output/<datum>-<formát>-<téma>/`)

| Soubor | Co to je |
|---|---|
| `images/*.jpg` | fotky 9:16 pro LTX |
| `clips/*.mp4` | klipy v pořadí segmentů |
| `script.json` | hook, segmenty, on-screen text, motion prompty, hashtagy |
| `narration.txt` | celý text komentáře (jde i do MPT WebUI ručně) |
| `mpt_request.json` | hotové tělo pro `POST /api/v1/videos` |
| `popisek_a_zdroje.txt` | popisek pod video + **autoři a licence fotek** |
| `ltx_jobs.json` | úlohy pro LTX |

> **Licence:** fotky z Commons jsou většinou CC BY / CC BY-SA. Autora a licenci je potřeba uvést,
> stačí v popisku videa. Text pro to je v `popisek_a_zdroje.txt`.

## MoneyPrinterTurbo

- Klipy se zkopírují do `<MPT>/storage/local_videos/<job>/`, protože novější MPT jiné cesty nepovolí.
  Starší fork bez `--mpt-dir` dostane absolutní cesty.
- `video_concat_mode=sequential` a `video_clip_duration` ≥ nejdelší klip: každý záběr se použije celý
  a ve správném pořadí. Synchronizace s hlasem je přibližná (odhad ~14 znaků/s pro edge-tts).
  Když hlas „utíká“, uprav `CHARS_PER_SECOND` v `svp/script.py`.
- Hlas: `cs-CZ-AntoninNeural-Male` (nebo `--voice cs-CZ-VlastaNeural-Female`), písmo `BeVietnamPro-Bold.ttf`
  (má české znaky).

## Testy

```bash
python -m unittest discover -s tests -t .
```
