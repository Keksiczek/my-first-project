# Interaktivní simulátor pohybu a práce ručního manipulanta

Tento projekt se zaměřuje na vývoj webové aplikace, která umožní plánovat a simulovat práci ručních manipulantů ve výrobní hale. Níže je kompletní specifikace funkcí, workflow i budoucího rozvoje dle aktuálně dostupných požadavků.

## Hlavní cíl
- Importovat reálný výrobní plán a parametry výrobků/strojů.
- Interaktivně spárovat a validovat výrobní dávky a parametry.
- Doplnit neúplná data pomocí uživatelského dialogu („wizard“).
- Umožnit vizuální layout výrobní haly (stroje, sklady, cesty).
- Simulovat vnitropodnikovou logistiku (VT) a trasování manipulace.
- Analyzovat efektivitu, časy VA/NVA a ergonomii.

## Funkce a workflow

### Krok 1 – Import dat
- Nahrání **dvou souborů současně**:
  - Výrobní plán (.xlsx) – fronta všech výrobních dávek (Stroj, SAP číslo, Název, Množství, Začátek, Konec, ...).
  - Parametry strojů/výrobků (.xlsx) – SAP, Stroj, typ balení, hmotnost 1 ks, počet v balení, předávací místo, popis extra činnosti.
- Automatické spárování plánu a parametrů dle kombinace (Stroj + SAP číslo).
- Zobrazení tabulky všech nahraných výrobních dávek.
- Zvýraznění nespárovaných řádků (chybějící údaje).

### Krok 2 – Výběr a validace zakázek
- Uživatelské rozhraní pro výběr zakázek pomocí checkboxů.
- Nespárované položky (⚠️) lze doplnit pomocí **modalního wizardu**:
  - Typ balení.
  - Počet v balení.
  - Hmotnost 1 ks.
  - Předávací místo.
  - Extra činnost.
- Funkce wizardu:
  - „Uložit a další“.
  - „Použít stejné pro všechny stejně značné řádky“.
  - „Přeskočit a použít default“.
- Barevné zvýraznění stavu validace – OK, chybí údaj, nepotvrzeno.

### Krok 3 – Potvrzení a přechod na layout
- Po validaci všech vybraných řádků se aktivuje tlačítko **„Pokračovat“**.
- Přechod na další stránku/krok aplikace.

### Krok 4 – Vizuální návrh rozložení haly (layout page)
- Interaktivní canvas umožňující:
  - Rozmístění strojů/pracovišť.
  - Umístění předávacích míst / skladů.
  - Definici cest pro manipulanty.
- Uživatel může objekty přetahovat, otáčet, propojovat.
- Možnost pojmenovávat body a ukládat rozmístění.

### Krok 5 – Nastavení a spuštění simulace
- Definice manipulantů, směn a variant tras.
- Simulace průběhu: trasování manipulantů, vyhodnocení časů, identifikace VA/NVA, hlášení konfliktů a kolizí.
- Výstupy ve formě grafů a tabulek (ergonomie, vytíženost, heatmapy pohybu).

## Klíčové vlastnosti
- 100% fallback na ruční doplnění chybějících dat.
- Moderní UX – uživatel vždy ví, co mu chybí.
- Responzivní design pro desktop i tablet.
- Export kompletních výpočtů do CSV, JSON a PDF.
- Podpora více výrobních hal, skupin strojů a variant layoutu.
- Automatická kontrola úplnosti parametrů všech zakázek.
- Používání výhradně open-source knihoven (bez vendor-lock).

## Výhled a budoucí kroky
- Animace pohybu manipulantů na layoutu.
- Optimalizace tras a vytížení v reálném čase.
- Analýza slabých míst – zbytečná chůze, čekání, ruční zásahy.
- Simulace více variant rozložení a export porovnání.
- Integrace s ERP/MES systémy.

## Nezbytné vstupy
- Vzorové výrobní plány (mohou být anonymizované).
- Reálné parametry kusů, balení, hmotností.
- Typické rozměry haly a layoutové podklady.
- Portfolio práce (pracovní směny, role, typy manipulace).

## Další kroky
Pokud je třeba zadání dále zpřesnit (např. strukturu wizardu, přesné požadavky na layout či simulaci), lze jej upravit podle potřeb projektového týmu.
