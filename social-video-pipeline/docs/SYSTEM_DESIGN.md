# Content Factory – návrh systému

Cíl: **jeden systém, víc typů médií**, lokálně na PC s 16GB GPU.
- **MoneyPrinterTurbo (MPT) je páteř**: hlas, titulky, skládání videa, popisky.
- Další enginy (LTX, Flux, showtime, ffmpeg) dodávají vizuál.
- **Lokální agenti** (Hermes + Ollama) plánují a schvalují, ale nikdy nedělají práci, kterou zvládne skript.

Stav: návrh (9. 10. 2026). Podklad pro lokální integraci v novém chatu.
API MPT ověřeno proti aktuálnímu upstreamu. **Tvůj fork je potřeba porovnat** (viz §8).

---

## 1. Principy

1. **Složka = stav.** Každá zakázka je složka s `job.json`. Pravdu drží souborový systém.
   Kanban (Hermes) je jen jednosměrné zrcadlo.
2. **Formát = recept (YAML).** Nový druh obsahu skládá hotové kroky, nepíše se nový skript.
3. **Nejdřív hlas, pak obraz.** MPT vyrobí hlas + titulky s časy. Podle nich se generují klipy
   přesně na délku a MPT pak složí video se *stejným* zvukem.
4. **Stávající pipeline se zabalí, nepřepisují.** Zajímavosti, ježek a chaloupky jedou dál svými skripty.
5. **Agent má úzký kanál.** Agent volá jen pár nástrojů s validovanými parametry, nikdy nepíše soubory.
6. **GPU má jednoho pána.** LLM a video model nikdy neběží současně (`gpu.lock` + fáze dávky).
7. **Fakta ze zdroje.** LLM jen přepisuje. Každé tvrzení má zdroj a každý obrázek autora a licenci.
8. **Člověk schvaluje před publikací.**

---

## 2. MPT jako páteř – co z něj používáme

| MPT API (`/api/v1/…`) | Použití v systému |
|---|---|
| `POST /audio` | **hlas** pro všechna média (video, showtime, audio klip) – jeden TTS pro vše |
| `POST /subtitle` | titulky s časy → **délky segmentů** pro LTX/Ken Burns/showtime |
| `POST /video_materials` | nahrání vlastních klipů (LTX, showtime, Ken Burns) do MPT |
| `POST /videos` | finální skládání: `video_source=local`, `sequential`, `custom_audio_file` = hlas z `/audio` |
| `POST /videos` (stock) | stávající zajímavosti (Pexels/Pixabay) beze změny |
| `POST /social-metadata` | popisky a hashtagy per síť (TikTok / IG / YT) |
| `POST /scripts`, `/terms` | jen pro staré formáty; nové píšou scénář samy s kontrolou faktů |
| `GET /tasks/{id}` | stav úlohy – orchestrátor čeká na dokončení |
| `GET /musics` | výběr hudby |

**LLM sdílí MPT i Factory:** v `config.toml` MPT nastavit `llm_provider = "ollama"` se stejným modelem.
Jedna instance Ollamy, jeden model v paměti.

### Tok „voice-first“ (řeší synchronizaci)

```
script.json ──► MPT /audio ──► voice.mp3
            └─► MPT /subtitle ─► subtitles.srt ─► délky segmentů (přesně, ne odhadem)
                                                   │
                     LTX / Ken Burns / showtime ◄──┘  (klip n má délku segmentu n)
                                                   │
             MPT /video_materials ◄── klipy ◄──────┘
             MPT /videos (local, sequential, custom_audio_file=voice.mp3) ──► final.mp4
             MPT /social-metadata ──► share/tiktok.txt, instagram.txt, youtube.txt
```

---

## 3. Architektura

```
┌─────────────── Lokální agenti (Hermes na Ollamě) ── jen nástroje s validací ──────────────┐
│  plánovač: factory_ideas · factory_new     kontrolor: factory_status · approve · retry     │
└────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                         ▼
┌──────────────────────────── ORCHESTRÁTOR „factory“ (python, systemd/cron) ─────────────────┐
│ jobs/ 00_inbox → 10_brief → 20_script → 30_voice → 40_visual → 50_assemble → 60_qa →        │
│       70_review → 80_ready → 90_published            ↘ 99_failed (log, retry od kroku)      │
│ gpu.lock · fáze dávky · idempotentní kroky · zrcadlo do kanbanu                             │
└──┬────────────┬──────────────┬─────────────────┬──────────────────┬────────────────────────┘
   ▼            ▼              ▼                 ▼                  ▼
 ZDROJE      SCÉNÁŘ         HLAS + TITULKY     VIZUÁL             SKLÁDÁNÍ + VÝSTUPY
 wiki-places Ollama (JSON   MPT /audio        ltx      (ComfyUI)  MPT /videos  → video 9:16/1:1
 wiki-history schema) +     MPT /subtitle     flux/sdxl(ComfyUI)  carousel     → PNG sada
 seznamy/CSV  kontrola                         showtime (CPU)     audio        → mp3 + titulky
 RSS/témata   faktů                            kenburns (ffmpeg)  MPT /social-metadata → texty
 legacy                                        stock    (MPT)     showtime qa  → kontrola
```

### 3.1 Zakázka (`jobs/<stav>/<id>/`)

```
job.json        # recept, téma, stav, historie kroků, chyby, pokusy, MPT task_id
brief.json      # položky + fakta + obrázky + licence (výstup zdroje)
script.json     # hook, segmenty, on-screen text, vizuální prompty, CTA
voice/          # voice.mp3, subtitles.srt, segments.json (start/konec segmentů)
visual/         # obrázky, klipy
out/            # final_9x16.mp4, final_1x1.mp4, carousel/*.png, audio.mp3, poster.jpg
share/          # tiktok.txt, instagram.txt, youtube.txt, credits.txt
logs/
```

### 3.2 Recept (`formats/*.yaml`)

```yaml
name: mista-o-kterych-nevis
media: [video, carousel]                 # co z jednoho briefu vznikne
source:   { plugin: wiki-places, params: { type: zricenina, region: "Olomoucký kraj", count: 5 } }
script:   { template: places, max_words_per_segment: 40 }
voice:    { engine: mpt, voice: cs-CZ-AntoninNeural-Male, rate: 1.0 }
visual:   { engine: ltx, fallback: kenburns, fit: blur }
assemble: { engine: mpt, aspect: ["9:16", "1:1"], bgm: random, font: BeVietnamPro-Bold.ttf }
review:   required
```

```yaml
name: jezek                                # stávající pipeline beze změny
media: [video]
legacy: { command: "~/videa/jezek/run.sh {topic} {job_dir}/out" }
review: required
```

---

## 4. Typy médií × formáty

Jeden `brief.json` → více médií. Data a fakta se stahují jednou.

| Formát | Video 9:16 | Carousel | Audio | Vizuál | GPU |
|---|---|---|---|---|---|
| Zajímavosti (stávající) | ✔ MPT stock | – | – | stock | ne |
| Ježek, chaloupky (stávající) | ✔ legacy | ✔ snímky z obrázků | – | Flux + LTX | ano |
| Místa, o kterých nevíš | ✔ | ✔ foto + fakt | – | LTX / Ken Burns | volitelně |
| Den v historii | ✔ | ✔ časová osa | ✔ „rádio“ | showtime / Ken Burns | ne |
| Tipni si (kvíz) | ✔ | ✔ otázka → odpověď | – | showtime | ne |
| Čísla / infografika | ✔ | ✔ | – | showtime | ne |
| Mapa vypráví | ✔ | – | – | showtime + fotky | ne |

**showtime** ([FavioVazquez/showtime](https://github.com/FavioVazquez/showtime)) se hodí jako vizuální engine
pro motion grafiku: renderuje HTML/canvas na **CPU**, takže může běžet souběžně s LTX na GPU. Má CLI
(`job init`, `render`, `qa`, `deliver exports`). V systému bere **hlas z MPT** (jeden hlas napříč
formáty) a `showtime qa` slouží jako krok `60_qa` pro všechna videa (hlasitost, černé snímky,
titulky, specifikace sítí). Ověřit: import vlastního audia a české znaky ve fontech.

---

## 5. Lokální agenti – jak je navrhnout, aby nechybovali

Lokální modely (7–14B) chybují v dlouhých úlohách, volném psaní souborů a nástrojích s mnoha
parametry. Proto:

### 5.1 Rozdělení rolí

| Role | Kdo | Volnost |
|---|---|---|
| **Plánovač** – co vyrobit | Hermes agent | vybírá z výčtu receptů a témat |
| **Scenárista** | Ollama volaná *skriptem* (ne agent) | jen JSON podle schématu, 1 úloha = 1 volání |
| **Kontrolor faktů** | skript + malé LLM „ano/ne“ | porovná větu se zdrojovým textem |
| **Render** | čisté skripty | žádné LLM |
| **Schvalovatel** | člověk (Telegram přes Hermes) | approve / reject s důvodem |

### 5.2 Pravidla pro nástroje agenta

- **Max. 6 nástrojů**, každý s ≤ 3 parametry. Výčty (`enum`) generované z receptů, takže model
  nemůže vymyslet neexistující formát.
  - `factory_ideas(format)` → 5 návrhů témat
  - `factory_new(format, topic)` → id zakázky
  - `factory_status(filter?)` → krátký přehled (ne celé JSONy – šetří kontext malého modelu)
  - `factory_approve(id)` / `factory_reject(id, reason)`
  - `factory_retry(id)`
- **Chyby jako věta s nápovědou:** „Formát 'hrady' neexistuje. Dostupné: mista-o-kterych-nevis, den-v-historii, …“
  Malý model se z toho opraví. Po 2 neúspěších jde zakázka do `needs_human`.
- **Agent nikdy nemění soubory v `jobs/` ani recepty.** Jeho chyba rozbije nejvýš jednu zakázku.
- **Kanban jen zrcadlí.** Orchestrátor po každém kroku zapíše stav (složka → kanban). Agent kanban
  nepotřebuje k řízení, takže chyby kanbanu v Hermesovi nic nerozbijí.

### 5.3 Pravidla pro LLM ve skriptech

- **Strukturovaný výstup:** Ollama `format` = JSON schema. Odpověď se validuje a při chybě
  jde jedna oprava s chybovou hláškou, pak šablona z textu zdroje.
- **Malé úlohy:** hook, segmenty a popisek generovat zvlášť. Na hook 5 variant a vybrat podle
  pravidel (délka, otázka/číslo na začátku).
- **Teplota:** 0.2 pro strukturu a fakta, 0.7–0.8 jen pro hooky.
- **Kontrola faktů:** čísla, roky a jména ze scénáře musí být ve zdrojovém textu, jinak se segment
  vrátí šablonou.

### 5.4 Modely na 16 GB (orientačně, ověřit)

| Úloha | Model | VRAM |
|---|---|---|
| Agent (plánování, nástroje) | 7–8B s dobrým tool-callingem (např. Qwen 2.5/3 7–8B, Hermes 3 8B) | ~5–6 GB |
| Scénáře (čeština) | 14B (např. Qwen 2.5 14B) | ~9–10 GB |
| LTX-Video i2v | fp8/distilled | ~10–15 GB |
| Flux / SDXL | fp8 | ~8–12 GB |
| MPT, showtime, ffmpeg | CPU | – |

Ollama: `keep_alive: 0` (nebo `ollama stop`) před GPU fází.

---

## 6. Plán dávky (noc)

```
fáze A  LLM  (GPU: Ollama)   brief → scénáře → kontrola faktů → popisky      | pak uvolnit VRAM
fáze B  CPU  (MPT)           /audio + /subtitle pro všechny zakázky           | souběžně s C
fáze C  GPU  (ComfyUI)       LTX / Flux klipy přesně na délky z fáze B, pod gpu.lock
fáze D  CPU                  showtime render, MPT /videos, carousel, showtime qa
ráno                         70_review → schválení z telefonu → 80_ready
```

---

## 7. Plán realizace

| Krok | Obsah | Výsledek |
|---|---|---|
| **1** | Repo `content-factory`: stavy, `job.json`, CLI `factory`, `gpu.lock`, MPT klient (`/audio`, `/subtitle`, `/video_materials`, `/videos`, `/tasks`) | kostra + MPT integrace |
| **2** | Recept `legacy` pro zajímavosti, ježka a chaloupky | stávající formáty v novém systému |
| **3** | Přesun `svp` → zdroje `wiki-places`, `wiki-history`; voice-first tok | 2 nové formáty, přesná synchronizace |
| **4** | Carousel výstup + `/social-metadata` → `share/` | víc médií ze stejných dat |
| **5** | showtime engine: Tipni si, Čísla; `showtime qa` pro vše | formáty bez GPU |
| **6** | Hermes: 6 nástrojů + zrcadlo kanbanu + schvalování z telefonu | autonomní noční dávky |
| **7** | CSV se zhlédnutími → priorita témat v `factory_ideas` | učení z výsledků |

---

## 8. Co přinést do nového chatu

- [ ] `tree -L 3` složek s videi + spouštěcí skripty (zajímavosti, ježek, chaloupky)
- [ ] **Fork MPT:** cesta, `git log --oneline -20`, `git diff` proti upstreamu (hlavně `app/models/schema.py`,
      `app/controllers/v1/`), `config.toml` **bez klíčů**. Ověřit, že má `/audio`, `/subtitle`,
      `custom_audio_file` a `video_source=local`.
- [ ] ComfyUI: LTX workflow a workflow obrázků jako **Export (API)** `.json`
- [ ] Hermes: profily, skills, model, příklad chyby v kanbanu
- [ ] `nvidia-smi`, `ollama list`, verze Pythonu a ComfyUI

Hotový kód pro nové formáty: větev `claude/social-video-pipeline`, složka `social-video-pipeline/`
(`python -m svp places|history`). Testy procházejí, skutečná data z Wikipedie zatím neověřena.
Krok 3 v něm nahradí odhad délky (`CHARS_PER_SECOND`) časy z MPT `/subtitle`.
