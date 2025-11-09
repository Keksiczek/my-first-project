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
| GET | `/api/health` | Health check API a databáze |

## 7. CSV import

CSV soubor musí obsahovat hlavičku: `itemName,quantity,dimension,material,position`.
Parser podporuje čárku, středník i tabulátor jako oddělovač a zvládá uvozovky i BOM.
Příklad obsahu:

```csv
itemName,quantity,dimension,material,position
"Plech 2mm",10,"d60x463","Cf 53",5633
"Šroub M6",50,"M6x20","Ocel",5661
```

## 8. Skripty

- `npm start` – spuštění serveru
- `npm run dev` – vývojový režim s automatickým restartem
- `npm run lint` – kontrola kódu ESLintem
- `npm run lint:fix` – automatická oprava formátování

## 9. Struktura projektu

```
src/
  config/        # databáze, logger, swagger
  constants/     # sdílené konstanty (statusy)
  controllers/   # business logika
  middleware/    # validace vstupů
  routes/        # Express routery se Swagger popisem
  utils/         # pomocné funkce (paginace, generování kódů)
```

## 10. Další poznámky

- Statusy jsou sjednoceny na hodnoty `pending`, `partial`, `complete`.
- Inventář vynucuje unikátní kombinaci `(barcode, warehouseId, position)` a automaticky odstraňuje záznamy s nulovým množstvím.
- Čárové kódy pro položky si zachovávají formát `MAT-YYMMDD-XXX` s kontrolou duplicit.
- Všechny zápisové operace běží v transakcích (MySQL InnoDB).
