# Jarmila v Hermesovi: osobnost a proaktivní komunikace

Report, 9. 10. 2026. Zdroj: oficiální dokumentace Hermes Agent v repu
[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (`website/docs`, commit `5d5e763`
z 9. 10. 2026) a zdrojový kód cron plánovače (`cron/scheduler.py`). Nic z toho jsem nespouštěl. Před
nasazením ověřit proti tvé nainstalované verzi (`hermes --version`).

## Shrnutí

**Ano, jde to, a Hermes na to má přímo nástroje.** Osobnost a proaktivita jsou dvě oddělené vrstvy:

| Vrstva | Mechanismus v Hermesovi | Co dává Jarmile |
|---|---|---|
| **Kdo je** | `SOUL.md` v jejím profilu (slot č. 1 v systémovém promptu) | stálá povaha, tón, čeština, kdy mluvit a kdy mlčet |
| **Co o tobě ví** | `USER.md` + `MEMORY.md` (automaticky v každé relaci), volitelně externí paměť | osobní kontext bez opakování |
| **Kdy se ozve sama** | `cron` (plánované úlohy), skriptová brána `wakeAgent`, `/heartbeat`, Bot Mode „Routines“ | ranní brief, upozornění, připomínky, hlášení z Content Factory |
| **Kde mluví** | gateway + vlastní Telegram bot profilu | píše ti do telefonu, dá se jí odpovědět |

Klíčové zjištění z kódu: **cron úlohy načítají `SOUL.md` i paměť** (`load_soul_identity=True`,
`skip_memory=False` v `cron/scheduler.py`). Jarmila tedy i v plánovaných zprávách mluví jako Jarmila
a zná tvůj profil. Nemá ale historii chatu, takže prompt úlohy musí být soběstačný.

---

## 1. Jarmila jako samostatný profil

Profil je samostatný domov Hermese (`~/.hermes/profiles/jarmila/`) s vlastním `config.yaml`, `.env`,
`SOUL.md`, pamětí, skills, cron úlohami a gatewayí. Po vytvoření vznikne příkaz `jarmila`.

```bash
hermes profile create jarmila --description "Osobní asistentka: denní přehled, připomínky, hlášení z Content Factory"
jarmila setup                      # model, klíče, Telegram
jarmila gateway install            # služba, která hlídá cron a Telegram
jarmila cron status                # běží plánovač?
```

Pravidla z dokumentace:
- **Nikdy dva procesy na jednom profilu.** Oba zapisují paměť a navzájem si ji kazí.
- **Vlastní Telegram bot.** Jeden bot token patří jen jednomu profilu. Klon profilu kanály záměrně
  nekopíruje. Bota založíš přes dashboard (**Messaging → Telegram → Create with QR**), nebo ručně
  do `~/.hermes/profiles/jarmila/.env`:
  ```bash
  TELEGRAM_BOT_TOKEN=…
  TELEGRAM_ALLOWED_USERS=<tvoje Telegram ID>
  TELEGRAM_HOME_CHANNEL=<ID chatu, kam má psát sama>
  ```
- Když už Jarmilu máš jako profil, nic nezakládej znovu. Jen uprav její `SOUL.md` a přidej úlohy níže.

**Bot Mode (desktopová aplikace):** z profilu udělá „Bota“ s avatarem, jedním trvalým chatem, vlastním
hlasem (`tts.*` v jejím `config.yaml`) a panelem **Routines**. Routines jsou obyčejné cron úlohy
pojmenované `[bot:jarmila] …`, takže to, co nastavíš v CLI, je vidět i tam. Avatar může být nahraný
obrázek nebo vygenerovaný portrét.

---

## 2. Osobnost: `SOUL.md`

Soubor: `~/.hermes/profiles/jarmila/SOUL.md`. Hermes ho vkládá doslova jako identitu (po kontrole na
prompt injection, dlouhý obsah zkrátí). **Patří sem povaha a styl, ne úkoly ani cesty.** Projektové
věci jdou do `AGENTS.md`, úkoly do promptů cron úloh.

Návrh, který si uprav:

```markdown
# Jarmila

Jsi Jarmila, osobní asistentka. Mluvíš vždy česky, tykáš, jsi věcná a vlídná,
s lehkým suchým humorem. Nejsi chatbot, jsi parťačka, která hlídá, co je potřeba.

## Styl
- Krátce. Zpráva do telefonu má mít nejvýš 5 řádků; detail jen když o něj požádám.
- Nejdřív to důležité, pak kontext. Konkrétní čísla a termíny místo obecných frází.
- Když něco nevíš, řekni to rovnou. Nevymýšlej si fakta, termíny ani stav úloh.
- Když se pletu nebo něco nedává smysl, ohraď se.

## Proaktivita
- Ozvi se sama, jen když to má pro mě hodnotu: něco čeká na mé rozhodnutí,
  něco selhalo, blíží se termín, nebo máš hotovou věc, na kterou čekám.
- Když se nic podstatného nezměnilo, mlč: odpověz jen [SILENT].
- Neopakuj, co už jsi hlásila. Neposílej motivační řeči ani výplň.
- Každá proaktivní zpráva končí jednou jasnou otázkou nebo nabídkou dalšího kroku.

## Čemu se vyhnout
- Podlézání, přehnané nadšení, emoji ve velkém, anglicismy tam, kde je český výraz.
- Dlouhé seznamy možností. Doporuč jednu a řekni proč.
```

Tipy:
- **Tón ladit na příkladech.** Když Jarmila zní moc „AI“, doplň do SOUL.md dvě tři ukázkové zprávy
  přesně ve stylu, jaký chceš. Malé lokální modely se řídí příklady líp než přídavnými jmény.
- **Dočasné módy** přes `/personality`, třeba pro brainstorming. Vlastní preset v `config.yaml`:
  ```yaml
  agent:
    personalities:
      jarmila-kreativni: >
        Jsi Jarmila v kreativním módu: navrhuješ odvážné nápady na videa, vždy 5 variant,
        každou jednou větou.
  ```
  Přepnutí: `/personality jarmila-kreativni`, zpět: `/personality none`.
- `display.language` přeloží jen rozhraní Hermese, ne odpovědi. Češtinu drží SOUL.md.

---

## 3. Paměť: co o tobě ví

- **`USER.md`** (max. 1 375 znaků): kdo jsi, jak chceš komunikovat, co tě zajímá, denní režim.
- **`MEMORY.md`** (max. 2 200 znaků): poznámky agenta o prostředí (cesty, služby, konvence).
- Obojí se načte jako **zmrazený snímek na začátku relace**. Co si zapamatuje během rozhovoru,
  uvidí až v další relaci. To je záměr, ne chyba.
- Starší rozhovory najde přes `session_search` („najdi, co jsme řešili o MPT“).
- Externí paměť (Honcho, Hindsight, Mem0…) přes `hermes memory setup` je volitelná. Pro soukromí
  a lokální provoz stačí vestavěná. Honcho podle dokumentace potřebuje API klíč.
- **Lokální model:** zpětná „revize paměti“ po konverzaci čeká na volné GPU (`auxiliary.background_review.defer: auto`),
  takže nekoliduje s renderem.

Doporučení: `USER.md` napiš ručně a krátce, ať se Jarmila neučí od nuly. Např. pracovní doba,
kdy nerušit, jaké formáty videí děláš a že schvaluješ z telefonu.

---

## 4. Proaktivní komunikace: pět mechanismů

### 4.1 Plánované zprávy (cron)

Úlohy běží v gatewayi profilu (`jarmila gateway install`). Každý běh je **nová relace se SOUL.md
a pamětí, ale bez historie chatu**. Prompt proto musí obsahovat vše potřebné.

```bash
# Ranní brief ve všední dny v 7:45
jarmila cron create "45 7 * * 1-5" "Připrav ranní přehled pro dnešek: 1) co čeká na schválení v Content Factory (spusť factory status), 2) co v noci selhalo, 3) jedna věc, kterou bych dnes neměl zapomenout. Max 6 řádků. Pokud není nic k nahlášení, odpověz jen [SILENT]." \
  --deliver telegram --name "ranni-brief" --continuity
```

- `--deliver telegram` pošle zprávu do `TELEGRAM_HOME_CHANNEL`, `origin` do chatu, kde úloha vznikla.
- `--continuity` přidá k promptu předchozí výstup úlohy („neopakuj, co už jsi hlásila“).
- `[SILENT]` v odpovědi znamená, že se nic neodešle (uloží se jen lokálně). Chyby se doručí vždy.
- **Odpovídání na zprávy:** `cron.mirror_delivery: true` v `config.yaml` nebo `attach_to_session` u úlohy.
  Na brief pak jde odpovědět a Jarmila ví, o čem mluví. V Telegramu s tématy (topics) se pro každý
  běh otevře vlastní vlákno.
- Uvnitř cron běhu agent nemůže zakládat další cron úlohy (ochrana proti zacyklení).

### 4.2 Skriptová brána `wakeAgent`: proaktivní, ale levná

Pro lokální model je tohle nejdůležitější. Cron úloha má **před-skript**, který rozhodne, jestli
vůbec budit LLM. Když ne, nestojí to žádný token ani GPU. Skripty musí ležet v
`~/.hermes/profiles/jarmila/scripts/`.

```python
#!/usr/bin/env python3
# ~/.hermes/profiles/jarmila/scripts/factory_watch.py
# Budí Jarmilu, jen když se v Content Factory něco změnilo.
import json, pathlib, datetime

JOBS = pathlib.Path.home() / "content-factory" / "jobs"
STATE = pathlib.Path(__file__).with_suffix(".state.json")

hour = datetime.datetime.now().hour
if hour >= 22 or hour < 7:                       # tichý režim řeší skript
    print(json.dumps({"wakeAgent": False})); raise SystemExit

now = {
    "review": sorted(p.name for p in (JOBS / "70_review").glob("*")),
    "failed": sorted(p.name for p in (JOBS / "99_failed").glob("*")),
}
prev = json.loads(STATE.read_text()) if STATE.exists() else {"review": [], "failed": []}
STATE.write_text(json.dumps(now))

new_review = [j for j in now["review"] if j not in prev["review"]]
new_failed = [j for j in now["failed"] if j not in prev["failed"]]
if not new_review and not new_failed:
    print(json.dumps({"wakeAgent": False}))
else:
    print(json.dumps({"wakeAgent": True,
                      "context": {"ke_schvaleni": new_review, "selhalo": new_failed}}))
```

```bash
jarmila cron create "every 15m" "V kontextu máš nové zakázky ke schválení a selhání z Content Factory. Napiš mi to krátce, u selhání přidej poslední řádek logu (factory status <id>). Zeptej se, jestli schválit." \
  --script factory_watch.py --deliver telegram --name "factory-watch"
```

(Dokumentace ukazuje `--script` v CLI u `--no-agent` úloh a `script=` s promptem u nástroje `cronjob`.
Kdyby CLI kombinaci s promptem odmítlo, založ úlohu přes chat: „vytvoř cron úlohu se skriptem
factory_watch.py a tímto promptem…“.)

Stejný vzor funguje na cokoliv: nový e-mail od konkrétního člověka, termín v kalendáři do 2 hodin,
dokončený noční render, plný disk. Kde stačí pevný text bez LLM, použij `--no-agent`: výstup
skriptu se pošle doslova, prázdný výstup znamená ticho.

**Hermes nemá vlastní tichý režim** (v dokumentaci jsem nenašel). Řeší se to ve skriptové bráně, jako výše.

### 4.3 `/heartbeat`: hlídání v rámci konverzace

Jedna opakovaná instrukce pro **aktuální chat, s celou jeho historií**. Hodí se na „hlídej tohle,
dokud to neskončí“:

```
/heartbeat every 30m Zkontroluj, jestli doběhla noční dávka videí. Až doběhne, shrň výsledek; jinak mlč.
```

Spustí se jen když chat zrovna nic nedělá. Zmeškané tiky se sloučí do jednoho a tvoje zpráva má
vždy přednost. V gatewayi může tiše skončit (`[SILENT]`), takže nic nepošle. Na chat je jen jeden heartbeat.
Pravidlo z dokumentace: potřebuje kontext rozhovoru → heartbeat; samostatná úloha → cron.

### 4.4 Řetězení úloh (`context_from`)

Úloha B dostane výstup úlohy A. Např. „sběr“ (skript, bez LLM) → „vyhodnocení“ (Jarmila) → „zpráva“.
Hodí se na týdenní shrnutí: data ze statistik videí → Jarmila napíše, co fungovalo.

### 4.5 Bot Mode Routines (desktop)

Totéž co cron, ale nastavené vedle Jarmilina chatu a výsledky padají přímo do jejího chatu.
Doručení `bot-chat` znamená, že výsledek si přečte Jarmila sama a zareaguje. Dá se tak předat
výsledek z jiného profilu (např. budoucí „Producent“) Jarmile, aby ti ho řekla svým hlasem.

---

## 5. Lokální model na 16 GB: realita

Z dokumentace Hermese:
- **Hermes potřebuje kontext aspoň 64 000 tokenů.** Ollama má výchozí 2048, takže je nutný Modelfile
  s `PARAMETER num_ctx 64000` a stejná hodnota v `model.context_length`.
- **Spolehlivé volání nástrojů** dokumentace ověřila jen u `gemma4:31b` (~20 GB, 24+ GB RAM).
  Do 16 GB VRAM se celý nevejde a s LTX by se pral o GPU.
- Velký pevný prompt (systém + schémata nástrojů) prodlužuje první odpověď. `hermes prompt-size`
  ukáže, co zabírá místo. Nepoužívané nástroje vypni (`hermes tools`), zbytečné skills odinstaluj.

Doporučení:
1. **Většinu proaktivity řeš skripty** (`wakeAgent`, `--no-agent`). LLM se budí jen pár krát denně.
2. **Pro cron vlastní menší model:** `hermes config set cron.model <model>` (v profilu Jarmily).
   Chat může běžet na větším modelu, plánované zprávy na menším.
3. **Vyzkoušet menší model s nástroji a 64K kontextem** (např. aktuální Qwen 7–14B nebo Gemma s tool
   calling). Otestovat na 10 typických úkolech, než ho nasadíš. Dokumentace jiné než gemma4 neověřila.
4. **Hlídat GPU s Content Factory:** dokumentace doporučuje `OLLAMA_KEEP_ALIVE=24h`, ale to drží VRAM
   a blokuje LTX. Řešení: factory před GPU fází zavolá `ollama stop <model>` pod `gpu.lock` a noční
   zprávy Jarmily jdou přes skripty. Případně Jarmila v noci mlčí.
5. **Alternativa:** chat Jarmily přes cloudového poskytovatele a lokální GPU jen na obsah. Hermes umí
   mít jiný model pro chat a pro cron.

---

## 6. Napojení na Content Factory (a proč ne přes kanban)

- Jarmila **neřídí kanban**. Agenti se v kanban nástrojích pletou, což hlásí i jiní uživatelé.
  Stav drží složky `jobs/`. Kanban může být jen zrcadlo.
- Jarmila dostane **jeden skill `factory`** s pěti příkazy (`status`, `new`, `approve`, `reject`, `retry`)
  a nic víc. Schvalování z telefonu: „Schval 2 a 3, u 4 předělej hook“ → `factory approve …`,
  `factory reject 4 "slabý hook"`.
- Proaktivitu dodá `factory_watch.py` (§ 4.2) a ranní brief (§ 4.1).

---

## 7. Postup zítra

1. `hermes --version` a `hermes profile list`: ověřit verzi a že profil existuje.
2. Napsat `SOUL.md` (§ 2) a krátký `USER.md` (§ 3). Otestovat 5 zpráv v chatu a doladit tón.
3. Ověřit Telegram bota profilu a `TELEGRAM_HOME_CHANNEL`. `jarmila gateway install`, `jarmila cron status`.
4. Ranní brief (§ 4.1) jako první cron. Spustit hned přes `jarmila cron run <id>`.
5. `factory_watch.py` (§ 4.2), jakmile bude Content Factory mít složky `jobs/`.
6. Model: Modelfile s `num_ctx 64000`, `model.context_length`, `cron.model`. Test volání nástrojů.
7. Přinést: aktuální `SOUL.md` Jarmily, `config.yaml` (bez klíčů), `hermes cron list`, příklad chyby v kanbanu.

## Rizika

| Riziko | Ochrana |
|---|---|
| Spamuje | `[SILENT]`, skriptová brána, `--continuity`, pravidla v SOUL.md |
| Píše v noci | tichý režim ve skriptu (Hermes ho nemá) |
| Vymýšlí si stav úloh | stav jen z `factory status`, ne z paměti; v SOUL.md „nevymýšlej“ |
| Malý model nezvládne nástroje | málo nástrojů, výčty, skripty místo LLM, test před nasazením |
| Kolize s GPU renderem | `gpu.lock`, `ollama stop` před GPU fází, noční zprávy přes skripty |
| Dva procesy na jednom profilu | každý agent svůj profil |
