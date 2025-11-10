# Warehouse System API (Node.js + MySQL)

Komplexní REST API pro řízení skladových objednávek, příjmu materiálu, pohybů a inventáře.

## 1. Technologický stack

- Node.js + Express
- MySQL (InnoDB)
- `mysql2`, `express-validator`, `csv-parse`
- Bezpečnost: `helmet`, `express-rate-limit`
- Logování: `winston`
- Dokumentace: Swagger (`swagger-ui-express`, `swagger-jsdoc`)

## 2. Instalace

1. Naklonuj repozitář / zkopíruj soubory.
2. Vytvoř databázi a tabulky:
   ```bash
   mysql -u root -p < schema.sql
   ```
   Pokud aktualizuješ existující databázi, spusť i skripty z adresáře `migrations/`.
3. Vytvoř soubor `.env` z šablony:
   ```bash
   cp .env.example .env
   ```
   a doplň přístupové údaje k MySQL a volitelné proměnné (`LOG_LEVEL`, `PORT`).
4. Nainstaluj závislosti:
   ```bash
   npm install
   ```
5. Spusť API:
   ```bash
   npm start       # produkční režim
   npm run dev     # vývojový režim s nodemonem
   ```

API poběží na `http://localhost:3000` (lze změnit proměnnou `PORT`).

## 3. Bezpečnost a monitoring

- **Helmet** přidává bezpečnostní HTTP hlavičky.
- **Rate limiting** omezuje počet požadavků na `/api/*` (100 / 15 min) a na import (10 / 15 min).
- **Winston** loguje požadavky a chyby do konzole a souborů ve složce `logs/`.
- **Health check** endpoint `GET /api/health` kontroluje stav API i dostupnost databáze.

## 4. Paginace

Všechny listovací endpointy podporují paginaci pomocí `page` (výchozí 1) a `limit` (výchozí 20, max 100).
Každá odpověď obsahuje objekt `pagination` s celkovým počtem záznamů, stránkami a informací o pokračování.

## 5. API dokumentace

Swagger UI je dostupné na `http://localhost:3000/api-docs`.
JSON specifikaci lze získat přes `http://localhost:3000/api-docs.json`.

## 6. Hlavní endpointy

| Metoda | Endpoint | Popis |
| ------ | -------- | ----- |
| POST | `/api/orders/create` | Vytvoření objednávky |
| GET | `/api/orders` | Seznam objednávek (filtry `status`, `supplier`) |
| GET | `/api/orders/{orderId}` | Detail objednávky |
| GET | `/api/orders/qr/{orderQR}` | Detail přes QR kód |
| POST | `/api/orders/generate-barcodes` | Seznam čárových kódů pro tisk |
| POST | `/api/import/csv` | Import objednávky z CSV |
| POST | `/api/receive` | Kompletní příjem položky |
| POST | `/api/receive/partial` | Částečný příjem |
| POST | `/api/inventory/move` | Přesun / zaskladnění materiálu |
| POST | `/api/consume` | Výdej/spotřeba materiálu |
| GET | `/api/inventory` | Paginovaný přehled skladu |
| GET | `/api/movements/{barcode}` | Historie pohybů daného materiálu |
| GET | `/api/warehouses` | Multi-skladová evidence a kapacity |
| POST | `/api/warehouses` | Vytvoření / editace skladů (admin) |
| GET | `/api/warehouse-positions` | Přehled pozic v jednotlivých skladech |
| GET | `/api/production` | Výrobní dávky s filtry a paginací |
| POST | `/api/production/start` | Zahájení výrobní dávky (operator, admin) |
| POST | `/api/production/stage/{stageId}/start` | Workflow mezioperací (start/pause/resume/complete) |
| GET | `/api/subproducts` | Evidence mezivýrobků a jejich stavů |
| POST | `/api/subproducts` | Ruční založení mezivýrobku |
| POST | `/api/subproducts/{id}/move` | Přesun mezivýrobku mezi sklady/stadii |
| POST | `/api/quality-checks` | Záznam kontroly kvality mezioperace |
| GET | `/api/quality-checks/report` | Souhrnný report výsledků |
| GET | `/api/export/inventory` | Export inventáře do CSV |
| POST | `/api/export/custom` | Vlastní export s filtry |
| GET | `/api/health` | Health check API a databáze |

## 7. Výroba, sklady a kvalita

- **Multi-sklady** – tabulka `warehouses` s pozicemi, kapacitami a statistikami. Endpointy `/api/warehouses` a `/api/warehouse-positions` podporují paginaci, filtrování a deaktivaci prázdných skladů.
- **Výrobní dávky** – `/api/production` spravuje plánování, stavové přechody a návazné mezioperace. Akce mezioperací (`start/pause/resume/complete`) jsou auditovány do tabulky logů.
- **Meziprodukty** – `/api/subproducts` eviduje díly vznikající během výroby, včetně aktuálního stadia a umístění na skladu.
- **Kontroly kvality** – `/api/quality-checks` zapisují výsledky mezioperací a aktualizují metriky přímo u jednotlivých operací. Souhrnný report je dostupný přes `/api/quality-checks/report`.
- **Exporty** – `/api/export/*` poskytují CSV export inventáře, výroby a sledovatelnosti. Vlastní export (`POST /api/export/custom`) umožňuje filtrovat tři základní resource.

### Role a oprávnění (RBAC)

| Role | Popis | Povolené akce |
| ---- | ----- | ------------- |
| `admin` | plný přístup | správa skladů, výroby, exportů, kvality |
| `operator` / `operator_full` | výrobní operátor | start/stop výrobních dávek, mezioperací, tvorba kvality, meziproduktů |
| `operator_limited` | skladový operátor | pouze příjem/výdej a čtení přehledů |
| `viewer` | náhled | pouze čtení (dashboard, exporty) |

Pro testování lze roli předat přes HTTP hlavičku `x-user-role` (a volitelně `x-user-id`). Produkční nasazení očekává, že autentizační middleware přiřadí `req.user.role`.

## 8. CSV import

CSV soubor musí obsahovat hlavičku: `itemName,quantity,dimension,material,position`.
Parser podporuje čárku, středník i tabulátor jako oddělovač a zvládá uvozovky i BOM.
Příklad obsahu:

```csv
itemName,quantity,dimension,material,position
"Plech 2mm",10,"d60x463","Cf 53",5633
"Šroub M6",50,"M6x20","Ocel",5661
```

## 9. Skripty

- `npm start` – spuštění serveru
- `npm run dev` – vývojový režim s automatickým restartem
- `npm run lint` – kontrola kódu ESLintem
- `npm run lint:fix` – automatická oprava formátování

## 10. Struktura projektu

```
src/
  config/        # databáze, logger, swagger
  constants/     # sdílené konstanty (statusy)
  controllers/   # business logika
  middleware/    # validace vstupů
  routes/        # Express routery se Swagger popisem
  utils/         # pomocné funkce (paginace, generování kódů)
```

## 11. Další poznámky

- Statusy jsou sjednoceny na hodnoty `pending`, `partial`, `complete`.
- Inventář vynucuje unikátní kombinaci `(barcode, warehouseId, position)` a automaticky odstraňuje záznamy s nulovým množstvím.
- Čárové kódy pro položky si zachovávají formát `MAT-YYMMDD-XXX` s kontrolou duplicit.
- Všechny zápisové operace běží v transakcích (MySQL InnoDB).

## 12. Testy

Ukázkové unit testy (Mocha + Chai) pokrývají logiku servisní vrstvy výroby (start dávky, přechody mezioperací, kontroly kvality, tvorba mezivýrobků).
Před spuštěním testů se ujisti, že máš nainstalované i vývojové závislosti (např. `npm install --include=dev`).

```
npm test
```
