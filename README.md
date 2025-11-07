# Warehouse System API (Node.js + MySQL)

Jednoduché REST API pro skladový / kanban systém (objednávky, příjem, zaskladnění, pohyby).

## 1. Technologický stack

- Node.js + Express
- MySQL (InnoDB)
- `mysql2`, `dotenv`, `cors`

## 2. Instalace

1. Naklonuj repozitář / zkopíruj soubory.
2. Vytvoř databázi a tabulky:

   ```bash
   mysql -u root -p < schema.sql
   ```

3. Vytvoř `.env` podle `.env.example`:

   ```bash
   cp .env.example .env
   ```

   a nastav hodnoty pro DB.

4. Nainstaluj závislosti:

   ```bash
   npm install
   ```

5. Spusť API:

   ```bash
   npm start
   # nebo
   npm run dev
   ```

API poběží na `http://localhost:3000`.

## 3. Hlavní endpointy

- `POST /api/orders/create` – vytvoření objednávky
- `GET /api/orders` – seznam objednávek
- `GET /api/orders/:orderId` – detail objednávky
- `GET /api/orders/qr/:orderQR` – detail přes QR
- `POST /api/receive` – příjem položky
- `POST /api/receive/partial` – částečný příjem
- `POST /api/inventory/move` – přesun / zaskladnění
- `GET /api/inventory` – přehled skladu
- `GET /api/movements/:barcode` – historie pohybů
- `POST /api/orders/generate/barcodes` – seznam čárových kódů pro tisk
- `POST /api/import/csv` – import položek z CSV do nové objednávky

## 4. Poznámky

- Autentizace zatím není – API je otevřené.
- Status objednávky se automaticky přepočítává podle `qtyReceived` u všech položek.
- Pohyby (`Movements`) se generují při příjmu a při přesunu.
- CSV import očekává hlavičku: `itemName,quantity,dimension,material,position`.
