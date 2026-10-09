# Content Factory – návrh systému

Cíl: **jeden software, víc druhů obsahu** pro sociální sítě, lokálně na PC s 16GB GPU.
Práci dělají deterministické skripty. Agent (Hermes / Claude) jen vybírá, spouští a schvaluje.

Stav: návrh (9. 10. 2026). Podklad pro lokální integraci v novém chatu.

---

## 1. Principy

1. **Složka = stav.** Každá zakázka je složka s `job.json`. Pravdu drží souborový systém, ne
   kanban ani paměť agenta. Kanban je jen zrcadlo.
2. **Formát = recept.** Nový druh obsahu znamená nový YAML recept, který skládá hotové kroky,
   ne nový skript od nuly.
3. **Enginy jsou výměnné.** MoneyPrinterTurbo, LTX (ComfyUI), showtime a ffmpeg mají stejné rozhraní
   `render(job_dir)`. Stávající pipeline (zajímavosti, ježek, chaloupky) se **zabalí, nepřepisují**.
4. **Agent má úzký kanál.** Agent nedostane volný přístup k souborům, jen pár příkazů CLI
   (`factory new / status / approve / retry`). Méně prostoru znamená méně chyb.
5. **Fakta ze zdroje, LLM jen přepisuje.** Každé tvrzení má zdroj v `sources.json` a každý obrázek
   autora a licenci.
6. **GPU má jednoho pána.** Na 16 GB nikdy neběží současně LLM a video model. Řeší to zámek a fáze dávky.
7. **Člověk schvaluje před publikací.** Krok `review` čeká na „OK“ (z telefonu přes Hermes/Telegram).

---

## 2. Architektura

```
            ┌───────────── Hermes / Claude (jen CLI příkazy) ──────────────┐
            │  factory new <formát> --topic …   factory status   approve   │
            └───────────────────────────┬──────────────────────────────────┘
                                        ▼
┌──────────────────────────── ORCHESTRÁTOR (python, cron/systemd) ─────────────────────────────┐
│  jobs/ 00_inbox → 10_brief → 20_script → 30_assets → 40_render → 50_qa → 60_review → 70_ready │
│                                                                    ↘ 99_failed (+ log, retry) │
│  gpu.lock · fáze dávky (LLM → GPU) · idempotentní kroky · zrcadlení stavu do kanbanu          │
└───────┬───────────────┬──────────────────┬──────────────────────┬───────────────────────────┘
        ▼               ▼                  ▼                      ▼
   ZDROJE          SCÉNÁŘ             PODKLADY                 ENGINY (render)
   wiki-places     Ollama + šablony   obrázky 9:16             mpt       (stock/lokální klipy + hlas + titulky)
   wiki-history    validace faktů     Flux/SDXL (ComfyUI)      ltx       (obrázek → video, ComfyUI)
   vlastní seznam  hook/CTA/hashtagy  Commons/Openverse        showtime  (motion grafika, infografiky, kvízy)
   RSS / témata                       TTS (edge/Piper)         kenburns  (ffmpeg, bez GPU)
                                      hudba, titulky (Whisper) carousel  (statické obrázky IG/FB)
                                        ▼
                         EXPORT: 9:16 · 1:1 · 16:9 · carousel · popisky per síť · credits
```

### 2.1 Zakázka (`jobs/<stav>/<id>/`)

```
job.json        # formát, téma, stav, historie kroků, chyby, počet pokusů
brief.json      # výstup zdroje: položky + fakta + obrázky + licence
script.json     # hook, segmenty, on-screen text, motion prompty, CTA, hashtagy
assets/         # obrázky, klipy, hlas, hudba
render/         # final_9x16.mp4, final_1x1.mp4, poster.jpg, captions.srt
share/          # popisek per síť (tiktok.txt, instagram.txt, youtube.txt), credits.txt
logs/
```

Přesun složky mezi stavy (`mv`) je atomický. Když něco spadne, zakázka skončí v `99_failed`
s logem a `factory retry <id>` ji vrátí tam, kde selhala.

### 2.2 Recept formátu (`formats/<název>.yaml`)

```yaml
name: mista-o-kterych-nevis
source:  { plugin: wiki-places, params: { type: zricenina, region: "Olomoucký kraj", count: 5 } }
script:  { template: places, llm: qwen2.5:14b, max_words_per_segment: 40 }
assets:  { images: commons, fit: blur }
render:  { motion: ltx, assemble: mpt, voice: cs-CZ-AntoninNeural-Male }
exports: [ "9:16", "1:1" ]
review:  required
```

Stávající formáty se stanou recepty, které volají tvoje skripty beze změny:

```yaml
name: jezek
render: { engine: legacy, command: "~/videa/jezek/run.sh {topic} {job_dir}" }
```

---

## 3. Formáty: co jde přes který engine

| Formát | Zdroj | Engine | GPU | Stav |
|---|---|---|---|---|
| Zajímavosti | stávající | MPT fork | malé | **zabalit** |
| Ježek, chaloupky | stávající | LTX + obrázky | ano | **zabalit** |
| Místa, o kterých nevíš | Wikidata / Commons | LTX nebo Ken Burns → MPT | ano / ne | **kód hotový** (`svp places`) |
| Den v historii | cs.wikipedia (den) | showtime (časová osa + archivní foto) nebo Ken Burns → MPT | ne | **kód hotový** (`svp history`) |
| Čísla / infografika | Wikidata, ČSÚ, vlastní CSV | showtime (animované grafy, kinetický text) | ne | nový |
| Tipni si (kvíz) | stejné briefy jako výše | showtime (otázka → odpočet → odpověď) | ne | nový |
| Mapa vypráví | souřadnice z `wiki-places` | showtime (SVG mapa + trasa) + fotky | ne | nový |
| Carousel | jakýkoli `brief.json` | Pillow/HTML šablona → PNG | ne | nový, levný |

**Klíčový přínos:** jeden `brief.json` (např. 5 hradů) dá **4 výstupy**: LTX video, kvíz „Tipni si,
kde to je“, mapu a carousel. Data i fakta se stahují jen jednou.

### Kam se hodí showtime ([FavioVazquez/showtime](https://github.com/FavioVazquez/showtime))

- Lokální „videostudio pro agenta“: motion grafika v HTML/CSS/canvas renderovaná v headless Chrome,
  hlas (Kokoro/Piper/Supertonic), 297 hudebních podkladů s credits, titulky v bezpečných zónách
  sítí, export 9:16/1:1/16:9 a `showtime qa` (hlasitost, černé snímky, titulky, specifikace sítí).
- **Běží na CPU**, takže nekoliduje s LTX na GPU. Může renderovat přes den, LTX v noci.
- Má CLI (`showtime job init`, `render`, `qa`, `deliver exports`), takže se dá řídit skriptem, ne jen agentem.
- **Ověřit:** český hlas (Piper má `cs_CZ`), jestli ho showtime nabízí. Jinak hlas z edge-tts / MPT
  a do showtime vložit hotové audio.
- **Bonus:** `showtime qa` použít jako krok `50_qa` i pro výstupy z MPT a LTX.

---

## 4. Rozpočet GPU (16 GB)

Orientační hodnoty, ověřit na tvém stroji:

| Úloha | VRAM | Poznámka |
|---|---|---|
| Ollama 14B (Q4) | ~9–10 GB | scénáře; po dávce `ollama stop` / `keep_alive: 0` |
| LTX-Video i2v (fp8/distilled) | ~10–15 GB | klipy 3–5 s; nejtěžší krok |
| Flux / SDXL (ComfyUI) | ~8–12 GB | obrázky pro ježka a chaloupky |
| Whisper (titulky) | ~2–5 GB | nebo CPU |
| showtime, ffmpeg, MPT skládání | CPU | lze souběžně s GPU krokem |

**Plán dávky:** večer `factory batch` → fáze A: všechny scénáře (LLM) → uvolnit VRAM →
fáze B: všechny GPU rendery (LTX/Flux) za sebou pod `gpu.lock` → fáze C: CPU skládání + QA.
Ráno čeká v `60_review` hotová várka ke schválení.

---

## 5. Agent (Hermes) a kanban

Problém: Hermes v kanbanu dělá chyby (známé i od jiných uživatelů – agenti se v kanban nástrojích
pletou). Řešení: **kanban není zdroj pravdy.**

- Orchestrátor po každém kroku zapíše stav zakázky do kanbanu (jednosměrně: složka → kanban).
  Kanban slouží jen k zobrazení.
- Agent má **4–5 příkazů**, nic víc:
  - `factory new <formát> [--topic …]` – založí zakázku
  - `factory status [--json]` – co je kde, co selhalo
  - `factory approve <id>` / `factory reject <id> "důvod"` – krok review
  - `factory retry <id>`
  - `factory ideas <formát>` – navrhne témata (jediné místo, kde má agent „tvůrčí“ volnost)
- Hermes skill = jen popis těchto příkazů. Agent nesahá do `jobs/` ani nemění recepty.
- Když agent udělá chybu, rozbije maximálně jednu zakázku, ne stav systému. `job.json` má historii.

---

## 6. Plán realizace

| Krok | Obsah | Výsledek |
|---|---|---|
| **1** | Repo `content-factory`; orchestrátor (stavy, `job.json`, CLI `factory`), zámek GPU | kostra, která umí `new/status/retry` |
| **2** | Zabalit stávající: MPT fork (zajímavosti), LTX workflow (ježek/chaloupky) jako `legacy` enginy | staré formáty jedou přes nový systém beze změny |
| **3** | Přesunout `svp` → zdroje `wiki-places`, `wiki-history` + recepty | 2 nové formáty v provozu |
| **4** | Engine showtime + formáty Kvíz a Čísla; `showtime qa` jako krok QA pro vše | první formáty bez GPU |
| **5** | Hermes skill s 5 příkazy + zrcadlení do kanbanu; schvalování z telefonu | autonomní noční dávky |
| **6** | Repurposing (1 brief → víc výstupů), carousel, popisky per síť | víc obsahu ze stejných dat |
| **7** (později) | Ruční CSV se zhlédnutími → žebříček formátů a témat → priorita v `factory ideas` | učení z výsledků |

---

## 7. Co přinést do nového chatu (lokálně)

- [ ] `tree -L 3` složek s videi (zajímavosti, ježek, chaloupky) + hlavní spouštěcí skripty
- [ ] LTX workflow z ComfyUI: **Export (API)** `.json` + workflow pro generování obrázků
- [ ] Fork MoneyPrinterTurbo (cesta / `git diff` proti originálu, `config.toml` bez klíčů)
- [ ] Hermes: konfigurace profilů, skills a příklad chyby v kanbanu
- [ ] Verze: GPU (`nvidia-smi`), Python, ComfyUI, Ollama modely (`ollama list`)
- [ ] Rozhodnout: nové repo `content-factory`, nebo rozšířit stávající lokální složku?

Hotový kód pro nové formáty: větev `claude/social-video-pipeline`, složka `social-video-pipeline/`
(`python -m svp places|history`, 16 testů prochází, skutečná data z Wikipedie zatím neověřena).
