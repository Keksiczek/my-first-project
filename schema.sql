-- Vytvoření databáze
CREATE DATABASE IF NOT EXISTS warehouse_system
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE warehouse_system;

-- Tabulka Orders
CREATE TABLE IF NOT EXISTS Orders (
  orderId      INT AUTO_INCREMENT PRIMARY KEY,
  sapNumber    VARCHAR(10) NOT NULL UNIQUE,
  orderQR      VARCHAR(50) NOT NULL UNIQUE,
  supplier     VARCHAR(255) NOT NULL,
  dateCreated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status       VARCHAR(50) NOT NULL DEFAULT 'Objednáno',
  notes        TEXT NULL
) ENGINE=InnoDB;

-- Tabulka OrderItems
CREATE TABLE IF NOT EXISTS OrderItems (
  itemId       INT AUTO_INCREMENT PRIMARY KEY,
  orderId      INT NOT NULL,
  barcode      VARCHAR(50) NOT NULL UNIQUE,
  itemName     VARCHAR(255) NOT NULL,
  quantity     INT NOT NULL,
  dimension    VARCHAR(255),
  material     VARCHAR(255),
  position     VARCHAR(50),
  qtyReceived  INT NOT NULL DEFAULT 0,
  status       VARCHAR(50) NOT NULL DEFAULT 'pending',
  dateReceived DATETIME NULL,
  CONSTRAINT fk_orderitems_order
    FOREIGN KEY (orderId) REFERENCES Orders(orderId)
    ON DELETE CASCADE,
  INDEX idx_orderitems_orderId (orderId),
  INDEX idx_orderitems_barcode (barcode)
) ENGINE=InnoDB;

-- Tabulka Inventory
CREATE TABLE IF NOT EXISTS Inventory (
  inventoryId  INT AUTO_INCREMENT PRIMARY KEY,
  barcode      VARCHAR(50) NOT NULL,
  warehouseId  VARCHAR(50) NOT NULL,
  position     VARCHAR(50) NOT NULL,
  qtyAvailable INT NOT NULL DEFAULT 0,
  dateAdded    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dateUpdated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_barcode
    FOREIGN KEY (barcode) REFERENCES OrderItems(barcode)
    ON DELETE CASCADE,
  INDEX idx_inventory_barcode (barcode),
  INDEX idx_inventory_location (warehouseId, position)
) ENGINE=InnoDB;

-- Tabulka Movements
CREATE TABLE IF NOT EXISTS Movements (
  movementId   INT AUTO_INCREMENT PRIMARY KEY,
  barcode      VARCHAR(50) NOT NULL,
  movementType VARCHAR(50) NOT NULL,
  fromWarehouse VARCHAR(50) NULL,
  fromPosition  VARCHAR(50) NULL,
  toWarehouse   VARCHAR(50) NULL,
  toPosition    VARCHAR(50) NULL,
  quantity      INT NOT NULL,
  notes         TEXT NULL,
  dateCreated   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movements_barcode
    FOREIGN KEY (barcode) REFERENCES OrderItems(barcode)
    ON DELETE CASCADE,
  INDEX idx_movements_barcode (barcode),
  INDEX idx_movements_type (movementType),
  INDEX idx_movements_date (dateCreated)
) ENGINE=InnoDB;

-- Vzorová objednávka
INSERT INTO Orders (sapNumber, orderQR, supplier, status, notes)
VALUES ('4500123456', 'ORD-4500123456-251107', 'Kovar s.r.o.', 'Objednáno', '');

SET @orderId := LAST_INSERT_ID();

-- Vzorové položky
INSERT INTO OrderItems (
  orderId, barcode, itemName, quantity, dimension, material, position, qtyReceived, status
) VALUES
  (@orderId, 'MAT-251107-001', 'Plech 2mm', 10, 'd60x463', 'Cf 53', '5633', 0, 'pending'),
  (@orderId, 'MAT-251107-002', 'Šroub M6', 50, 'M6x20', 'Ocel', '5661', 0, 'pending');

-- Vzorový záznam ve skladu
INSERT INTO Inventory (barcode, warehouseId, position, qtyAvailable)
VALUES ('MAT-251107-001', 'Sklad-A', 'B2', 10);

-- Vzorový pohyb
INSERT INTO Movements (barcode, movementType, toWarehouse, toPosition, quantity, notes)
VALUES ('MAT-251107-001', 'receive', 'Sklad-A', 'B2', 10, 'Testovací příjem');
