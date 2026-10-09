# Content OS: blueprint systému pro tvorbu obsahu

**Verze 1 · 9. 10. 2026.** Architektonický návrh, ne implementace. Zítra porovnat s lokálními soubory
(viz § 22 „Srovnávací list“). Podrobnější technické poznámky jsou v `SYSTEM_DESIGN.md`
a o Jarmile v `JARMILA_HERMES.md`.

> **Jedna věta:** Systém nevyrábí „videa“, ale **pořady**. Každý pořad má bibli (formát, postavy,
> styl, hlas, pravidla) a z ní vznikají epizody. Ty projdou stejnou výrobní linkou nad výměnnými
> enginy (MPT, Spotlight, LTX, ComfyUI…). Agenti navrhují, skripty vyrábějí, člověk schvaluje
> a data z publikace se vracejí do plánování.

---

## Obsah

1. Výchozí stav (předpoklady)
2. Co říká průzkum: osm omezení, která tvarují návrh
3. Principy
4. Architektura ve vrstvách
5. Klíčové objekty (datový model)
6. Univerzální mezivrstva: časová osa epizody
7. Životní cyklus epizody
8. Vrstva enginů (schopnosti a adaptéry)
9. Plánování zdrojů na jedné GPU
10. Kontinuita: navazující LTX a stálé postavy
11. Agenti a lidé
12. Kvalita
13. Soulad s pravidly a práva
14. Učící smyčka (analytika → plánování)
15. Distribuce a recyklace obsahu
16. Provoz a dohled
17. Uložení dat (struktura složek)
18. Plán zavádění
19. Rozhodnutí k potvrzení (ADR)
20. Jak měřit, že systém funguje
21. Rizika a anti-vzory
22. Srovnávací list na zítřek
23. Zdroje

---

## 1. Výchozí stav (předpoklady, ověřit zítra)

| Oblast | Co předpokládám, že máš | Jistota |
|---|---|---|
| Hardware | 1 PC, NVIDIA 16 GB VRAM, Linux/Windows | od tebe |
| Generování + publikace | upravený **MoneyPrinterTurbo** + **Spotlight** | od tebe. *Spotlight upřesnit: je to showtime, nebo jiný nástroj?* |
| Video | **LTX** image-to-video, klipy na sebe **navazují** (řetězení) | od tebe |
| Obrázky | generování obrázků („image base“) pro LTX | od tebe |
| Pořady | Zajímavosti, Ježek, Chaloupky (+ další?) | od tebe |
| Agenti | **Hermes Agent**, profil **Jarmila**, kanban s chybami | od tebe |
| Řízení | lokální složky řízené skripty | od tebe |
| Starší infrastruktura | `ai-home-hub` (FastAPI, Ollama, ChromaDB, fronta úloh, Grafana/Prometheus, Tailscale) | z GitHubu; nevím, jestli běží |
| Geodata | `experience-app` (OSM/Wikidata/Mapillary, ověřená místa) | z GitHubu |
| Nové zdroje | `social-video-pipeline` (Místa, Den v historii) | větev `claude/social-video-pipeline` |

**Blueprint nic z toho nenahrazuje.** Stávající nástroje se stanou „enginy“ (§ 8) a stávající
pořady první „bible“ (§ 5).

---

## 2. Co říká průzkum: osm omezení, která tvarují návrh

| # | Zjištění | Důsledek pro návrh |
|---|---|---|
| 1 | **Formát (seriál) je víc než téma.** Opakovaný slib divákovi („co dostanu“) s proměnlivým obsahem uvnitř funguje lépe než náhodná témata. | Základní jednotkou je **Pořad**, ne video. |
| 2 | **YouTube „inauthentic content“** (přejmenováno 7/2025, upřesněno 7/2026): nemonetizuje se hromadná výroba podle šablony („stejná struktura, jen jiné téma“), čtení cizího textu a slideshow bez komentáře. AI samo o sobě nevadí. | Automatizovat **výrobu**, ne **tvořivost**. Každý pořad má „rozpočet variability“ a kontrolu podobnosti s předchozími epizodami. Člověk schvaluje plán. |
| 3 | **EU AI Act čl. 50 platí od 2. 8. 2026.** Deepfakes (realistický obsah, který může působit jako skutečný) musí být označené. U zjevné fikce a umění stačí minimální označení. Kodex praxe a pokyny Komise jsou z 7/2026. Platí i pro obsah veřejně na internetu. | Samostatný krok **Soulad**: klasifikace epizody (fikce / realistické / reálná místa), štítky na platformách, C2PA podpis jako poslední krok. |
| 4 | **Platformy AI samy detekují a označují.** TikTok čte C2PA. YouTube má v API pole `containsSyntheticMedia` (realistický pozměněný nebo syntetický obsah). | Deklarovat poctivě a automaticky. Nespoléhat na „neodhalí to“. |
| 5 | **Algoritmy:** rozhodují první 1–3 s („chose to view“ / swipe-away), dokoukanost, opakované přehrání a sdílení. Shorts a long-form mají oddělená doporučování. | **Laboratoř hooků** a měření na úrovni epizody. Délka a hook se ladí podle platformy. |
| 6 | **16 GB VRAM je úzké hrdlo.** LTX-2.5 se vejde jen kvantizovaný (GGUF/FP8) s přesouváním do RAM, protože jeho textový enkodér sám má ~15 GB. Hermes chce ≥ 64K kontext. Vše najednou neběží. | **Plánovač zdrojů**: dávky podle modelu, denní a noční směna, zámek GPU. |
| 7 | **Lokální modely chybují v nástrojích.** Dokumentace Hermese spolehlivé volání nástrojů ověřila jen u velkého modelu (gemma4:31b, ~20 GB). Agenti se pletou v kanbanu. | Agenti mají **úzké rozhraní** (jeden MCP server s pár nástroji), skriptové brány, JSON schémata. Stav nikdy nedrží agent. |
| 8 | **Česko:** YouTube ~8 mil. uživatelů, Instagram ~3–3,7 mil., TikTok ~2 mil. dospělých (roste, mladí). TikTok API bez auditu publikuje jen soukromě. | Priorita YouTube (Shorts + **long-form kompilace**), TikTok a Reels jako druhé čtení. Publikaci nechat ve stávajícím nástroji. |

---

## 3. Principy

1. **Pořad je produkt, epizoda je výrobek.** Bible pořadu je zdroj pravdy o formátu a stylu.
2. **Jedna výrobní linka, výměnné enginy.** Nový formát = nová bible + šablona, ne nový kód.
3. **Univerzální mezivrstva.** Vše se skládá do *časové osy epizody* (§ 6). Renderer (MPT, Spotlight…) je až poslední krok.
4. **Stav drží soubory a účetní kniha, ne agent ani kanban.** Složka = stav, SQLite = rychlé dotazy.
5. **Agenti navrhují, skripty vykonávají, člověk schvaluje.** Agent nikdy nesahá přímo na soubory.
6. **GPU má rozvrh.** Úlohy se slučují podle modelu, těžké věci v noci.
7. **Každé tvrzení má zdroj, každý asset licenci, každá epizoda deklaraci AI.**
8. **Variabilita je měřená.** Systém hlídá, aby epizody nebyly šablonovité (monetizace, diváci).
9. **Data se vracejí.** Metriky z publikace ovlivňují plán dalších epizod. Rozhoduje člověk.
10. **Postupné zavádění.** Nejdřív obalit, co funguje. Přepisovat jen to, co brzdí.

---

## 4. Architektura ve vrstvách

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ L5  ČLOVĚK        Telegram (Jarmila) · Schvalovací tabule (web přes Tailscale) · Týdenní plán │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L4  AGENTI        Jarmila (rozhraní, proaktivita) · Showrunner (plán) · Kritik (QA)        │
│  (Hermes profily)  Analytik (výsledky)  ── jen přes Factory MCP + webhooky ──             │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L3  ZNALOSTI      Bible pořadů · Banka témat · Kniha tvrzení (fakta+zdroje) ·             │
│                   Knihovna assetů (licence, embeddingy) · Historie publikací · Metriky    │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L2  TOVÁRNA       Účetní kniha úloh · Stavový automat · Plánovač zdrojů ·                 │
│  (jádro)          Kompilátor časové osy · Brány kvality a souladu · Události              │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L1  ENGINY        TTS · obrázky (ComfyUI) · i2v + řetězení (LTX) · motion grafika          │
│  (adaptéry)       (Spotlight/showtime) · skládání (MPT) · hudba · QA nástroje · publikace │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ L0  INFRA         GPU 16 GB · CPU · disky · Ollama · ComfyUI · Tailscale · Grafana · zálohy │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Hranice mezi vrstvami jsou smlouvy:**
- L4 → L2 jen přes **Factory MCP** (nástroje) a **události** (webhook do Hermese).
- L2 → L1 jen přes **adaptéry**. Každý engine má stejný tvar: vstupní artefakt → výstupní artefakt, deklarované zdroje (GPU/VRAM/čas) a idempotenci.
- L2 ↔ L3 přes soubory a SQLite. L3 je jediná paměť systému; agenti mají jen vlastní osobní paměť.

---

## 5. Klíčové objekty (datový model)

Pojmy a vztahy, ne implementace.

```
Pořad (Show) ──1:N── Řada/Oblouk (Arc) ──1:N── Epizoda
   │                                            │
   ├─ Bible: formát, beaty, tón, publikum,       ├─ Brief (zadání + zdroje)
   │   postavy (referenční listy), styl/kit,     ├─ Scénář (segmenty, hook varianty)
   │   hlas, hudební paleta, hook vzory,         ├─ Časová osa (scény → záběry → stopy)   § 6
   │   tabu, výchozí AI klasifikace,             ├─ Assety (hlas, obrázky, klipy, hudba)
   │   rozpočet variability                      ├─ Render(y) (master + varianty)
   │                                             ├─ Balíčky pro platformy (titulek, popis, cover, štítky)
   ├─ Stav kontinuity (postavy, místa, rekvizity)├─ Kontrolní karta (QA + soulad)
   └─ Experimenty (hooky, délky, styly)          ├─ Rozhodnutí (schválení, zamítnutí + důvod)
                                                 ├─ Publikace (platforma, ID, čas, deklarace)
                                                 └─ Metriky (snímky v čase)

Sdílené:  Téma (banka) · Tvrzení (fakt + zdroj + ověření) · Asset (soubor + licence + původ + embedding)
```

**Bible pořadu** je nejdůležitější nový artefakt. Pro Ježka obsahuje například:
- **Slib:** co divák dostane.
- **Beaty:** struktura epizody, např. hook → problém → zvrat → pointa → háček na další díl.
- **Postavy:** referenční listy, LoRA a hlas.
- **Vizuální kit:** paleta, písmo, intro a outro.
- **Pravidla:** co se nikdy nestane.
- **Výchozí AI klasifikace:** zjevná fikce, tedy minimální označení.
- **Rozpočet variability:** co se smí opakovat a co se musí měnit.

Stávající pořady dostanou bibli jako první krok (§ 18).

---

## 6. Univerzální mezivrstva: časová osa epizody

**Tohle dělá systém univerzálním.** Scénář se nepřekládá rovnou do parametrů MPT nebo Spotlightu.
Nejdřív vznikne časová osa nezávislá na enginu:

```
Epizoda
 └─ Scéna (účel: hook / obsah / zvrat / CTA)
     └─ Záběr (délka podle hlasu)
         ├─ vizuál:  { druh: generovaný | navazující-LTX | stock | grafika | foto+pohyb | avatar,
         │             zadání, reference postav, kontinuita (z předchozího záběru) }
         ├─ hlas:    segment textu + časy slov
         ├─ titulky: styl z kitu pořadu
         ├─ vrstvy:  grafika (fakt, mapa, graf), loga, štítky
         └─ zvuk:    hudba (cue), efekty, ducking
```

- **Kompilátory (renderery)** čtou časovou osu a vyrábějí výstup. MPT poskládá klipy s hlasem
  a titulky. Spotlight/showtime udělá grafické záběry a vrstvy. ffmpeg slouží na jednoduché sestavy.
  Stejná epizoda tak jde vyrobit různými enginy a nový engine nemění pořady.
- **Ruční úprava:** časovou osu jde exportovat do formátu **OpenTimelineIO** (`.otio`, přes
  adaptéry FCP XML/EDL) a otevřít ve střižně, např. DaVinci Resolve. Když automat něco nezvládne,
  epizodu dotáhneš ručně a nezačínáš od nuly.
- **Délky řídí hlas:** nejdřív hlas, z něj časy segmentů, pak vizuál na míru. Tím se řeší synchronizace.

---

## 7. Životní cyklus epizody

```
 PLÁN ──► BRIEF ──► SCÉNÁŘ ──► STORYBOARD ──► HLAS ──► VIZUÁL ──► SKLADBA ──► BALÍČEK ──► QA+SOULAD ──► SCHVÁLENÍ ──► PUBLIKACE ──► MĚŘENÍ ──► UČENÍ
  [H]       [A]       [A]         [A]          [A]      [A,GPU]     [A]         [A]          [A]            [H]           [A]          [A]        [H]
```

| Krok | Vstup → výstup | Kdo | Zdroj |
|---|---|---|---|
| **Plán** (týdenní „slate“) | bible + banka témat + metriky → seznam epizod na týden | Showrunner navrhne, **člověk potvrdí** | LLM (den) |
| **Brief** | téma → fakta se zdroji, reference, cíle | skript (+ zdroje dat) | síť, CPU |
| **Scénář** | brief + bible → segmenty, 3–5 variant hooku | LLM se schématem + kontrola faktů | LLM |
| **Storyboard** | scénář → časová osa (záběry, druh vizuálu, kontinuita) | LLM + pravidla bible | LLM |
| **Hlas** | text → audio + časy slov | TTS engine | CPU/online |
| **Vizuál** | záběry → obrázky, klipy, grafika | ComfyUI/LTX, Spotlight | **GPU (noc)**, CPU |
| **Skladba** | časová osa + assety → master video | MPT / Spotlight / ffmpeg | CPU |
| **Balíček** | master → varianty pro platformy, titulky, popisy, cover, štítky | skript + LLM | CPU/LLM |
| **QA + soulad** | balíček → kontrolní karta (§ 12, § 13) | skripty + Kritik (VLM) | CPU/GPU |
| **Schválení** | karta + náhled → ano / ne + důvod | **člověk** (Telegram / tabule) | |
| **Publikace** | schválené → platformy | tvůj stávající nástroj | síť |
| **Měření** | ID publikací → metriky (1 h, 24 h, 7 dní) | adaptéry API | síť |
| **Učení** | metriky → hodnocení hooků, formátů a témat → priority plánu | Analytik + člověk | LLM (týdně) |

Každý krok je **idempotentní**: když spadne, zopakuje se jen on. Výstup kroku je soubor
v epizodní složce a stav se zapíše do účetní knihy.

**Brány:**
- Plán a Schválení jsou vždy lidské.
- U nového pořadu je lidská i brána po Scénáři. Když pořad běží stabilně, tahle brána se zruší.
- QA brána je automatická: jeden automatický pokus o opravu, pak předání člověku.

---

## 8. Vrstva enginů (schopnosti a adaptéry)

Pořady nežádají konkrétní nástroj, ale **schopnost**. Registr určí, který engine ji dodá.

| Schopnost | Teď (u tebe) | Upgrade / alternativa | Zdroj |
|---|---|---|---|
| `tts.cs` (hlas + časy slov) | edge-tts v MPT | Supertonic (cs, lokálně), Piper cs_CZ-jirka, XTTS-v2 (klon hlasu, **jen nekomerčně**) | CPU/online |
| `image.gen` | tvoje „image base“ (ComfyUI?) | Flux/SDXL, Qwen-Image | GPU |
| `image.edit.consistent` (stejná postava v nové scéně) | ? | Qwen-Image-Edit-2511, Flux Kontext, LoRA na postavu | GPU |
| `i2v` | LTX | LTX-2.3 FP8; Wan 2.2 (kvalita, pomalé) | GPU |
| `i2v.chain` (navazující klipy) | **tvoje LTX řetězení** | LTX-2.5 latent continuation / first-last frame / multishot (GGUF) | GPU |
| `motion.graphics` | Spotlight? | showtime, HyperFrames | CPU |
| `assemble.short` | **MPT** | ffmpeg, Spotlight | CPU |
| `music` | MPT bgm / knihovna | ACE-Step 1.5 (< 4 GB, hudba přesně na délku) | GPU (krátce) |
| `avatar.talk` | – | InfiniteTalk (na Wan 2.1) | GPU |
| `qa.tech` | – | ffprobe, loudness, `showtime qa` | CPU |
| `qa.visual` | – | Qwen3-VL-8B (snímky), DefectVideoReward | GPU |
| `subtitles.cs` | MPT | Whisper large-v3(-turbo) pro kontrolu | GPU/CPU |
| `publish.*` | **MPT/Spotlight** | Postiz (API); TikTok vyžaduje audit API klienta | síť |
| `provenance.c2pa` | – | c2patool (podpis jako poslední krok) | CPU |
| `metrics.*` | – | YouTube Analytics API, Instagram insights, TikTok (omezené) | síť |

**Smlouva adaptéru** (stejná pro všechny):
- vstup a výstup jsou soubory podle schématu,
- adaptér deklaruje zdroje (GPU ano/ne, VRAM, odhad času) a idempotenci,
- adaptér vrací kontrolní data (co použil, verze modelu, seed).

Stávající skript se stane adaptérem tak, že dostane obal, ne že se přepíše.

---

## 9. Plánování zdrojů na jedné GPU

```
           06:00                    18:00                     24:00                    06:00
GPU   │ LLM interaktivní (Jarmila, scénáře) │ obrázky │ LTX řetězy (dlouhé) │ hudba │ VLM QA │
CPU   │ hlas · skladba · grafika · balíčky · QA ── běží pořád, nezávisle na GPU ──────────── │
SÍŤ   │ zdroje dat · publikace v plánovaných časech · metriky (1 h / 24 h / 7 d)            │
```

1. **Dávky podle modelu.** Načtení modelu je drahé, proto se úlohy řadí podle modelu, ne podle epizody:
   všechny scénáře, pak všechny obrázky, pak všechna videa. Pořadí epizod uvnitř dávky určuje priorita.
2. **Zámek GPU a výměna modelu.** Než se načte video model, plánovač uvolní LLM (`ollama stop`).
   Pořád jen jeden model na GPU.
3. **Denní a noční směna.** Přes den má přednost interaktivní LLM (Jarmila, scénáře) a krátké
   obrázkové úlohy. V noci jedou dlouhé LTX řetězy, hudba a vizuální QA. Jarmila v noci odpovídá
   z menšího modelu, nebo jen skripty (`wakeAgent`).
4. **Kontrolní body.** Dlouhý LTX řetěz se ukládá po segmentech. Po pádu pokračuje od posledního segmentu.
5. **Fronty podle typu úlohy.** Krátká obrázková úloha nečeká za hodinovým videem (oddělené fronty, priorita).
6. **Rozpočet:** maximum GPU hodin na noc a na pořad, aby jeden pořad nezabral celý stroj.

---

## 10. Kontinuita: navazující LTX a stálé postavy

Navazující klipy už máš. Blueprint z nich dělá **systémovou vlastnost pořadu**:

| Prvek | Kde žije | K čemu |
|---|---|---|
| **Referenční list postavy** (více pohledů, výrazy) | bible pořadu | zdroj pravdy o vzhledu |
| **LoRA / reference postavy** | bible pořadu | stabilita napříč epizodami |
| **Stav kontinuity** (kde postava je, denní doba, rekvizity, poslední snímek) | oblouk / epizoda | navázání záběrů i dílů |
| **Pravidla řetězení** (poslední snímek → první, překryv, prolínání) | adaptér `i2v.chain` | plynulé spoje |
| **Kontrola driftu** (podobnost tváře/stylu s referencí) | QA | zachytí „jiného ježka“ |

Upgrade cesty, kdy budou potřeba:
- **LTX-2.5:** navazování přes latentní prostor, první/poslední snímek, víc záběrů v jednom běhu. Na 16 GB jen GGUF a s offloadem.
- **Qwen-Image-Edit-2511:** konzistentní klíčové snímky před i2v.

**Pro seriály (Ježek, Chaloupky):** oblouk o několika dílech jde na konci sestříhat do **long-form
kompilace** pro YouTube. Je to obsah s vyšší hodnotou a zároveň obrana proti „šablonovitosti“.

---

## 11. Agenti a lidé

### 11.1 Role

| Role | Typ | Pravomoc | Spouštění | Model |
|---|---|---|---|---|
| **Jarmila** | Hermes profil, jediný hlas k tobě | čte stav, předkládá ke schválení, předává tvé rozhodnutí | tvoje zprávy, cron, webhook z továrny | chat: střední model (nebo cloud); cron: menší |
| **Showrunner** | Hermes profil (back-office) | **navrhuje** týdenní plán z bible, témat a metrik | cron 1× týdně | střední, s nástroji |
| **Kritik** | skript + VLM (ne agent) | hodnotí, nerozhoduje | krok QA | Qwen3-VL-8B + pravidla |
| **Analytik** | Hermes profil nebo skript + LLM | týdenní zpráva: co fungovalo a proč | cron 1× týdně | střední |
| **Scenárista** | **volání LLM uvnitř linky**, ne agent | píše jen JSON podle schématu | krok Scénář | nejlepší česky (14–27B Q4) |
| **Ty** | člověk | schvaluješ plán a finály, měníš bible | Telegram, tabule | – |

Pravidla:
- Každý agent má **vlastní profil**. Dokumentace Hermese zakazuje dva procesy na jednom profilu.
- Navenek mluví jen Jarmila. Ostatní jí předávají výsledky (Bot Mode doručení `bot-chat` nebo soubor).
- Agent **nemá přístup k souborům továrny**, jen k nástrojům.

### 11.2 Rozhraní: Factory MCP (jedno, malé)

Hermes umí MCP servery a filtrovat jejich nástroje. Továrna nabídne jeden MCP server s cca 8 nástroji:

| Nástroj | Kdo smí |
|---|---|
| `status(filtr)` – krátký přehled, ne celé JSONy | všichni |
| `slate_propose(pořad, týden)` – návrh plánu | Showrunner |
| `episode_new(pořad, téma)` | Showrunner, Jarmila (na tvůj pokyn) |
| `review_list()` / `review_decide(id, ano/ne, důvod)` | Jarmila (předává tvé rozhodnutí) |
| `retry(id, krok)` | Jarmila |
| `metrics_summary(pořad, období)` | Analytik, Jarmila |
| `ideas(pořad)` – kandidáti témat z banky | Showrunner |

Parametry jsou výčty z registru pořadů, takže agent nemůže vymyslet neexistující pořad. Chyby vrací
jako větu s nápovědou.

### 11.3 Události: továrna → Jarmila

Továrna při události pošle **webhook do Hermese** (podporované routy s HMAC, i `cron_job` trigger).
Typické události: „epizody čekají na schválení“, „noční dávka hotová“, „něco selhalo dvakrát“,
„video překonalo průměr pořadu“. Jarmila pak napíše **jednu** souhrnnou zprávu (slučování,
tichý režim ve skriptu). Detail je v `JARMILA_HERMES.md`.

### 11.4 Kanban

**Nepoužívat k řízení.** Buď úplně vypustit, nebo jen jednosměrně zrcadlit stav z účetní knihy.
Kanbanu nic nehrozí, protože na něm nic nezávisí.

---

## 12. Kvalita

Šest vrstev kontrol. Každá epizoda dostane **kontrolní kartu** s výsledkem všech:

| Vrstva | Co kontroluje | Jak |
|---|---|---|
| **Technická** | rozlišení, fps, hlasitost (−14 LUFS), černé a zamrzlé snímky, ořez, bezpečné zóny | ffprobe, loudnorm, `showtime qa` |
| **Fakta** | každé číslo, rok a jméno ve scénáři je v knize tvrzení se zdrojem | skript + LLM ano/ne |
| **Jazyk** | čeština, přepis hlasu = scénář (TTS chyby, špatné skloňování jmen) | Whisper přepis vs. scénář |
| **Vizuál** | artefakty, deformace, text v obraze, drift postavy | VLM na vzorku snímků, podobnost s referencí |
| **Originalita** | podobnost s posledními N epizodami pořadu (text, struktura, vizuál) pod limitem | embeddingy scénářů, perceptuální hash snímků |
| **Platforma** | délka, poměr stran, titulky v bezpečné zóně, cover, délka popisu | pravidla pro každou platformu |

Výsledek: **zelená** (rovnou ke schválení), **žlutá** (ke schválení s poznámkou), **červená**
(automatická oprava jednou, pak člověk). Prahy se ladí podle zkušeností a jsou v bibli pořadu.

---

## 13. Soulad s pravidly a práva

*Pracovní návrh, ne právní rada. Ověřit u oficiálních pravidel platforem a Komise.*

### 13.1 Klasifikace epizody (podle obsahu, ne podle nástroje)

| Třída | Příklad | Návrh deklarace |
|---|---|---|
| **A – zjevná fikce / animace** | Ježek, Chaloupky (stylizované) | minimální označení (popis „vytvořeno s AI“); YouTube `containsSyntheticMedia` spíš ne; zkontrolovat C2PA |
| **B – realistické, ale vymyšlené** | fotorealistická scéna, která se nestala | **označit** (EU čl. 50 deepfake), YouTube `containsSyntheticMedia = true`, AI štítek TikTok/Meta |
| **C – reálná místa nebo události, pozměněné AI** | „Místa“: skutečná fotka rozpohybovaná LTX | **označit** (pozměněný záznam reálného místa), poznámka „ilustrační animace“ |
| **D – grafika a fakta bez realistických záběrů** | infografika, kvíz, mapa | AI hlas/scénář uvést v popisu; synthetic flag ne |

Výchozí třídu určuje bible pořadu. Storyboard ji může zpřísnit (např. když se v pohádkovém
pořadu objeví realistický záběr).

### 13.2 Mechanismy

- **Štítky na platformách:** při publikaci podle třídy (YouTube pole v API, TikTok a Meta přepínač AI obsahu).
- **C2PA:** podpis manifestu (`c2patool`) jako **úplně poslední krok**, protože každá úprava po podpisu ho zneplatní.
- **Kniha licencí:** každý asset nese původ a licenci: Commons (CC BY-SA → povinné uvedení autora), hudba,
  písma, **licence TTS modelů** (XTTS-v2 je jen nekomerční!), LoRA a checkpointy. Popisek videa se generuje
  s povinnými credits.
- **Monetizační pojistka:** originalita (§ 12) + rozpočet variability v bibli + lidsky schválený plán.
  Long-form kompilace a série s příběhem jsou bezpečnější než nekonečné varianty jedné šablony.
- **TikTok API:** bez auditu klienta jen soukromé příspěvky. Publikovat stávajícím nástrojem, případně audit.

---

## 14. Učící smyčka (analytika → plánování)

```
publikace ──► sběr metrik (1 h, 24 h, 7 d) ──► karta epizody ──► přehled pořadu ──► týdenní zpráva ──► plán dalšího týdne
                 YouTube Analytics API             hook-rate           trend, top/bottom    (Analytik →        (Showrunner navrhne,
                 IG insights (část v „in dev“)     dokoukanost         experimenty          Jarmila)            člověk potvrdí)
                 TikTok (omezené / ručně CSV)      sdílení, follow
```

- **Karta epizody:** „chose to view“ / swipe-away (hook), průměrné % zhlédnutí, dokoukanost,
  opakování, sdílení, uložení, noví sledující. Vše vztažené k **průměru pořadu**, ne absolutně.
- **Experimenty:** jedna proměnná naráz (hook varianta, délka, styl titulků, čas publikace) a zápis do bible.
- **Témata:** banka témat dostává skóre podle výkonu podobných epizod. Showrunner to zohlední,
  ale nepřebírá slepě (prevence uzavření v bublině).
- **TikTok:** Display API je jen pro čtení a omezené. Počítat s ručním CSV exportem nebo vynechat.
- **Pravidlo:** data navrhují, člověk rozhoduje. Nejdřív sbírat aspoň 2–3 týdny, pak teprve optimalizovat.

---

## 15. Distribuce a recyklace obsahu

| Z jedné epizody | Jak | Proč |
|---|---|---|
| Short 9:16 pro **YouTube** | master | největší publikum v ČR |
| TikTok, Reels | **jiný hook text, popis a cover** pro každou platformu, ne stejný upload | „druhé čtení“ obsahu, menší riziko duplicity |
| Čtverec 1:1 / Stories | ořez a přeskládání v kompilátoru | feed |
| Carousel | klíčové snímky + fakta | IG/FB, levné |
| **Long-form kompilace** | oblouk (Ježek, Chaloupky) nebo „Top 10 míst“ | monetizace, vyšší hodnota, obrana proti šablonovitosti |
| Komunitní příspěvek / anketa | otázka z epizody | interakce |

**Kadence:** podle pořadu v bibli. Průzkum doporučuje kvalitu před objemem (3–5 týdně na pořad
místo „co nejvíc“). Plánovač publikací rozkládá vydání, aby nebyly všechny ve stejný čas.

---

## 16. Provoz a dohled

- **Účetní kniha úloh** (SQLite): stav, kroky, časy, chyby, verze modelů a seedy. Z ní se dá vždy říct „proč to vypadá takhle“.
- **Metriky stroje:** fronta, GPU využití, VRAM, doba kroků. Grafana/Prometheus z `ai-home-hub`, pokud běží.
- **LLM trasování (volitelně):** Langfuse self-host (MIT, ale potřebuje Postgres + ClickHouse). Až když bude potřeba ladit prompty.
- **Denní zdraví:** Jarmila ráno shrne, co se vyrobilo, co čeká a co selhalo (skriptová brána, žádný spam).
- **Verzování:** bible, šablony, prompty a schémata v gitu. Změna bible je commit, takže jde zpětně zjistit, proč se pořad změnil.
- **Zálohy:** bible, účetní kniha, kniha tvrzení a licencí denně; hotové mastery týdně; mezivýstupy (raw klipy) se po publikaci smí mazat.
- **Úklid disku:** pravidla retence pro mezivýstupy. LTX řetězy a raw klipy rychle zaplní disk.

---

## 17. Uložení dat (struktura složek)

Navazuje na tvoje skriptově řízené složky. Jen koncept, názvy se přizpůsobí tomu, co máš.

```
content-os/
├─ shows/                       # pořady (git)
│   └─ jezek/
│       ├─ bible.yaml           # formát, beaty, tón, kit, hlas, pravidla, AI třída, variabilita
│       ├─ characters/          # referenční listy, LoRA, hlasy
│       ├─ kit/                 # grafika, písma, intro/outro (Spotlight/showtime)
│       └─ continuity.json      # stav oblouku
├─ knowledge/
│   ├─ topics.db                # banka témat + skóre
│   ├─ claims.db                # tvrzení + zdroje
│   ├─ assets/                  # knihovna (s licencemi a embeddingy)
│   └─ licenses.db
├─ factory/
│   ├─ ledger.db                # účetní kniha úloh
│   ├─ engines.yaml             # registr schopností → adaptéry
│   └─ schedule.yaml            # směny, rozpočty GPU
├─ jobs/                        # epizody podle stavu (složka = stav)
│   ├─ 10_planned/ 20_brief/ 30_script/ 40_storyboard/ 50_voice/ 60_visual/
│   ├─ 70_assembled/ 80_qa/ 85_review/ 90_ready/ 95_published/ 99_failed/
│   └─ <epizoda>/ brief.json script.json timeline.json assets/ renders/ package/ card.json
├─ metrics/                     # snímky metrik + týdenní zprávy
└─ adapters/                    # obaly kolem MPT, Spotlight, LTX, ComfyUI, TTS…
```

---

## 18. Plán zavádění

Každá fáze má **výstupní kritérium**. Další fáze začíná, až je splněné.

| Fáze | Co | Hotovo, když |
|---|---|---|
| **0 Inventura** (zítra) | porovnat blueprint s lokálními soubory, vyplnit mapovací tabulku (§ 22) | víme, co je engine, co pořad, co chybí |
| **1 Obal a kniha** | účetní kniha + stavy + adaptéry kolem MPT, Spotlight, LTX řetězení (bez přepisu) | stávající pořady jedou přes továrnu se stejným výsledkem |
| **2 Bible** | bible pro Ježka, Chaloupky, Zajímavosti; kit, postavy, AI třída | každá epizoda vzniká z bible |
| **3 Časová osa** | storyboard → časová osa → kompilátory (MPT, Spotlight); hlas jako první | jedna epizoda jde vyrobit dvěma enginy |
| **4 Agenti** | Factory MCP, webhooky, Jarmila (schvalování), Showrunner (plán) | týdenní plán a schvalování z telefonu bez otevření PC |
| **5 Kvalita a soulad** | kontrolní karta, klasifikace AI, štítky, C2PA, licence | každá publikace má kartu a deklaraci |
| **6 Učení** | sběr metrik, karty, týdenní zpráva | plán týdne odkazuje na data |
| **7 Nové pořady a recyklace** | Místa, Den v historii, kvíz; long-form kompilace; varianty pro platformy | nový pořad = nová bible, žádný nový kód |
| **8 Upgrady** | LTX-2.5 (GGUF), Qwen-Image-Edit-2511, ACE-Step, InfiniteTalk, lokální TTS | podle potřeby, přes registr enginů |

---

## 19. Rozhodnutí k potvrzení (ADR)

| # | Otázka | Doporučení | Proč | Alternativa |
|---|---|---|---|---|
| D1 | Kde držet stav | **složky + SQLite účetní kniha** | sedí na tvoje skripty, žádná nová infrastruktura | Hatchet / DBOS (Postgres), až když přerosteš |
| D2 | Kde běží agenti | **Hermes** (už ho máš) | profily, cron, webhooky, MCP, Telegram | Resident Agent z `ai-home-hub` |
| D3 | Univerzální mezivrstva | **vlastní časová osa (JSON) + export OTIO** | nezávislost na enginu + ruční úpravy ve střižně | parametry MPT jako formát (svazuje s MPT) |
| D4 | Motion grafika | **Spotlight, pokud ho máš a stačí** | žádná nová závislost | showtime / HyperFrames |
| D5 | LLM pro Jarmilu | **hybrid: chat střední lokální nebo cloud, cron menší lokální** | 16 GB nestačí na všechno najednou | čistě lokální s přísným rozvrhem |
| D6 | Kanban | **nepoužívat k řízení** | chybovost, zbytečná závislost | jednosměrné zrcadlo |
| D7 | Hlas | **začít edge-tts (máš), testovat Supertonic** | XTTS jen nekomerčně; Chatterbox česky neumí | vlastní klon hlasu, až bude jasná licence |
| D8 | Publikace | **stávající nástroj** | funguje; TikTok API vyžaduje audit | Postiz |
| D9 | Schvalovací tabule | **Telegram (Jarmila) + jednoduchá web stránka přes Tailscale** | náhled videa na mobilu, rychlé ano/ne | jen Telegram |

---

## 20. Jak měřit, že systém funguje

**Severka:** *zhlédnutí (nebo noví sledující) na hodinu tvého času.*

| Metrika | Cíl (prvních 8 týdnů) |
|---|---|
| Lidský čas na epizodu (plán + schválení) | < 5 min |
| Epizody bez ruční opravy (zelená karta) | > 70 % |
| Selhání linky (na epizodu) | < 10 %, žádné tiché |
| Od nápadu po publikaci | < 48 h (běžné), < 7 dní (seriál) |
| Využití GPU v noci | > 60 % |
| Hook-rate a dokoukanost vs. průměr pořadu | trend nahoru |
| Epizody s deklarací AI a credits | 100 % |

---

## 21. Rizika a anti-vzory

| Riziko / anti-vzor | Projev | Ochrana |
|---|---|---|
| **Šablonovitost** | demonetizace, pokles dosahu | bible s variabilitou, kontrola originality, oblouky, long-form |
| **Agent drží stav** | ztracené úlohy, chaos v kanbanu | stav jen v účetní knize, agent přes MCP |
| **Všechno najednou na GPU** | pády (OOM), pomalost | plánovač, dávky podle modelu, směny |
| **Halucinace faktů** | ostuda, nedůvěra | kniha tvrzení, kontrola faktů, zdroje v popisu |
| **Licence** (TTS, hudba, CC BY-SA) | stržení videa, spor | kniha licencí, credits automaticky |
| **Spam od Jarmily** | ignoruješ ji | slučování událostí, tichý režim, jedna zpráva |
| **Přeoptimalizace na metriky** | clickbait, únava publika | člověk rozhoduje, experimenty po jedné proměnné |
| **Velký přepis** | týdny bez výstupu | obalit, ne přepsat; fáze s výstupními kritérii |
| **Disk** | plný disk uprostřed noci | retence mezivýstupů, hlídání místa skriptem |
| **Závislost na jedné platformě** | ban / změna algoritmu | recyklace na víc platforem, vlastní archiv masterů |

---

## 22. Srovnávací list na zítřek

Zítra lokálnímu Claudovi dej tenhle dokument a nech ho vyplnit tabulku. Pak se rozhodne, co je fáze 1.

### 22.1 Mapovací tabulka

| Komponenta blueprintu | Co existuje lokálně (cesta / nástroj) | Stav (✔ / částečně / ✘) | Mezera |
|---|---|---|---|
| Bible pořadů (§ 5) | | | |
| Časová osa / storyboard (§ 6) | | | |
| Účetní kniha + stavy (§ 7) | | | |
| Adaptér MPT (§ 8) | | | |
| Adaptér Spotlight (§ 8) | | | |
| Adaptér LTX řetězení (§ 8, § 10) | | | |
| Generování obrázků (§ 8) | | | |
| Hlas (§ 8) | | | |
| Publikace (§ 8) | | | |
| Plánovač GPU (§ 9) | | | |
| Kontinuita postav (§ 10) | | | |
| Jarmila + Hermes (§ 11) | | | |
| Factory MCP / webhooky (§ 11) | | | |
| Kontrola kvality (§ 12) | | | |
| Soulad: AI štítky, C2PA, licence (§ 13) | | | |
| Metriky a učení (§ 14) | | | |
| Recyklace / long-form (§ 15) | | | |
| Monitoring, zálohy (§ 16) | | | |

### 22.2 Otázky pro lokálního Clauda

1. Jak přesně teď vzniká epizoda Ježka od nápadu po publikaci? Které skripty, v jakém pořadí, kde jsou mezivýstupy?
2. Co je **Spotlight**: jaký nástroj, co dělá (grafika, publikace, obojí)?
3. Jak funguje řetězení LTX klipů: poslední snímek → další klip? Jak se drží postava?
4. Kde se ukládá stav (soubory, DB, kanban)? Co se stane, když běh spadne uprostřed?
5. Jaké úpravy má fork MPT oproti originálu (hlavně publikace)?
6. Co dělá Jarmila dnes a kde konkrétně kanban selhává?
7. Kolik VRAM spotřebuje každý krok a co běží současně?
8. Jaké metriky se dnes sbírají (pokud vůbec)?
9. Jak se dnes řeší AI štítky a licence při publikaci?
10. Běží ještě `ai-home-hub` (Grafana, Tailscale, fronta úloh)?

### 22.3 Rozhodnout zítra

- D1–D9 (§ 19): potvrdit nebo změnit.
- Který pořad bude **pilot** pro fáze 1–3. Doporučuji **Ježka**: má řetězení, postavu i oblouk,
  takže otestuje nejvíc částí blueprintu.

---

## 23. Zdroje

**Platformy a regulace**
- YouTube inauthentic content (přehledy 2026): [Flocker](https://flocker.tv/posts/youtube-inauthentic-content-ai-enforcement/), [LensPOV](https://lenspov.com/articles/youtube-ai-content-demonetization-2026), [NoobClaw – pravidla z 16. 7.](https://noobclaw.com/blog/ai-video-monetization-youtube-2026-inauthentic-rules/), [AuditSocials](https://www.auditsocials.com/blog/youtube-inauthentic-content-policy-2026-mass-produced-ai-generated-monetization-creators-brands)
- EU AI Act čl. 50: [Komise – Kodex praxe](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content), [Faegre Drinker – pokyny 7/2026](https://www.faegredrinker.com/en/insights/publications/2026/7/eu-ai-act-commission-confirms-transparency-code-of-practice-as-adequate-and-publishes-final-version-of-its-guidelines-on-transparency-obligations), [Reed Smith](https://www.reedsmith.com/our-insights/blogs/viewpoints/102nbz0/transparency-obligations-for-ai-generated-content-the-code-of-practice-adequacy/), [TechPolicy.press](https://www.techpolicy.press/what-the-eus-new-ai-code-of-practice-means-for-labeling-deepfakes/)
- YouTube API `containsSyntheticMedia`: [revision history](https://developers.google.com/youtube/v3/revision_history)
- TikTok: [AI štítky / C2PA](https://www.tubefilter.com/?p=180011), [Content Posting API – audit](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Content sharing guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines)
- Instagram insights: [Meta reference](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights/)
- Algoritmy 2026: [Socialync – Shorts](https://www.socialync.io/blog/youtube-shorts-algorithm-2026), [Digital Applied](https://www.digitalapplied.com/blog/how-social-media-algorithms-work-2026), [1of10 – Shorts analytika](https://1of10.com/blog/youtube-shorts-analytics/)
- Formáty a série: [OutlierKit](https://outlierkit.com/resources/faceless-youtube-growth-strategy/), [ShortsFast – kadence](https://shortsfast.com/blog/faceless-youtube-posting-frequency-2026/)
- Česko: [MediaGuru](https://www.mediaguru.cz/tiktok-vladne-mladym-instagram-drzi-znacky), [CC.cz – AMI Digital](https://cc.cz/live/ami-digital-pocet-cechu-na-tiktoku-stoupl-za-dva-roky-o-dve-petiny/)

**Modely a nástroje**
- Video: [LTX-2.3 vs Wan 2.2 vs Hunyuan](https://ltxworkflow.com/blog/ltx-2-3-vs-hunyuanvideo-vs-wan2-2-comparison-2026), [LTX-2.5 VRAM](https://ltxworkflow.com/guide/ltx-2-5-vram-requirements), [LTX-2.5 v ComfyUI](https://docs.comfy.org/tutorials/video/ltx/ltx-2-5), [ComfyUI-LTX2-LongVideo](https://github.com/YuanBaoSMadLab/ComfyUI-LTX2-LongVideo), [LTX hardware](https://ltx.io/blog/hardware-for-ai-video-models)
- Konzistence postav: [Qwen-Image-Edit-2511](https://qwen.ai/blog?id=qwen-image-edit-2511), [Kontext vs Qwen](https://builderai.tools/blog/ai-image-editing-flux-kontext-qwen-image-edit-step1x)
- Hlas: [XTTS-v2](https://huggingface.co/coqui/XTTS-v2), [Chatterbox jazyky](https://www.mintlify.com/yocxy2/chatterboxyocxy/api/supported-languages), [Piper jirka](https://huggingface.co/rhasspy/piper-voices/blob/4d68f18217d5c6a4b2418c8c46222d6fcd698acb/cs/cs_CZ/jirka/low/cs_CZ-jirka-low.onnx.json), showtime/Supertonic (kód: `skills/showtime/lib/st/voice/voices.py`)
- Hudba: [ACE-Step 1.5](https://www.amd.com/en/blogs/2026/commercial-grade-ai-music-generation-on-amd-ryzen-ai-and-radeon-ace-step-1-5.html)
- Avatar: [InfiniteTalk](https://www.pixelsham.com/?p=25678)
- QA: [Qwen3-VL-8B](https://lmstudio.ai/models/qwen/qwen3-vl-8b), [DefectVideoReward](https://huggingface.co/CaoruiLi/DefectVideoReward)
- Motion grafika: [showtime](https://github.com/FavioVazquez/showtime), [HyperFrames](https://github.com/heygen-com/hyperframes), [Remotion skills](https://www.tella.com/blog/how-to-use-remotion-agent-skills-with-claude-code.md)
- Časová osa: [OpenTimelineIO adaptéry](https://opentimelineio.readthedocs.io/en/latest/tutorials/write-an-adapter.html)
- C2PA: [c2patool](https://opensource.contentauthenticity.org/docs/c2patool/)
- Orchestrace: [Upstash – durable workflow engines 2026](https://upstash.com/blog/durable-workflow-engines-compared-every-major-option-in-2026), [ComfyUI API (Runflow)](https://www.runflow.io/blog/comfyui-api-developer-guide)
- Pozorování LLM: [Langfuse self-hosting](https://langfuse.com/self-hosting.md)
- Čeština v LLM: [BenCzechMark](https://direct.mit.edu/tacl/article/doi/10.1162/TACL.a.32/132962/BenCzechMark-A-Czech-Centric-Multitask-and), [ithope.cz](https://www.ithope.cz/en/blog/umi-lokalni-ai-cesky-co-ukazuji-benchmarky-a-co-z-toho-plyne-pro-firmu/)
- Hermes Agent: oficiální dokumentace v repu [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (`website/docs`, commit 5d5e763): profiles, personality, cron, heartbeat, webhooks, MCP, local-ollama-setup

*Většina zdrojů o algoritmech a monetizaci jsou blogy třetích stran. Konkrétní čísla (prahy retence apod.)
berte jako orientační. Oficiální pravidla platforem a Komise mají přednost.*
