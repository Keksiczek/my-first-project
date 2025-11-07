-- Přidání unikátního klíče pro kombinaci barcode + warehouse + position
ALTER TABLE Inventory 
  ADD CONSTRAINT uk_inventory_location UNIQUE (barcode, warehouseId, position);

-- Sjednocení stavů objednávek na anglické hodnoty
ALTER TABLE Orders 
  MODIFY status VARCHAR(50) NOT NULL DEFAULT 'pending';

UPDATE Orders 
SET status = CASE 
  WHEN status IN ('Objednáno', 'pending') THEN 'pending'
  WHEN status IN ('Částečně přijato', 'partial') THEN 'partial'
  WHEN status IN ('Kompletně přijato', 'complete') THEN 'complete'
  ELSE status
END;

-- Sjednocení stavů položek objednávek
ALTER TABLE OrderItems 
  MODIFY status VARCHAR(50) NOT NULL DEFAULT 'pending';

UPDATE OrderItems 
SET status = CASE 
  WHEN status IN ('pending', 'Objednáno') THEN 'pending'
  WHEN status IN ('partial', 'Částečně přijato') THEN 'partial'
  WHEN status IN ('complete', 'Kompletně přijato') THEN 'complete'
  ELSE status
END;

-- Odstranění prázdných záznamů ve skladu
DELETE FROM Inventory WHERE qtyAvailable = 0;
