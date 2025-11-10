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
  status       VARCHAR(50) NOT NULL DEFAULT 'pending',
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
  CONSTRAINT uk_inventory_location UNIQUE (barcode, warehouseId, position),
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
VALUES ('4500123456', 'ORD-4500123456-251107', 'Kovar s.r.o.', 'pending', '');

SET @orderId := LAST_INSERT_ID();

-- Vzorové položky
INSERT INTO OrderItems (
  orderId, barcode, itemName, quantity, dimension, material, position, qtyReceived, status
) VALUES
  (@orderId, 'MAT-251107-001', 'Plech 2mm', 10, 'd60x463', 'Cf 53', '5633', 0, 'pending'),
  (@orderId, 'MAT-251107-002', 'Šroub M6', 50, 'M6x20', 'Ocel', '5661', 0, 'pending');

-- Vzorový záznam ve skladu
INSERT INTO Inventory (barcode, warehouseId, position, qtyAvailable)
VALUES ('MAT-251107-001', 'Sklad-A', 'B2', 10)
ON DUPLICATE KEY UPDATE qtyAvailable = VALUES(qtyAvailable);

-- Vzorový pohyb
INSERT INTO Movements (barcode, movementType, toWarehouse, toPosition, quantity, notes)
VALUES ('MAT-251107-001', 'receive', 'Sklad-A', 'B2', 10, 'Testovací příjem');

-- Tabulka Users
CREATE TABLE IF NOT EXISTS Users (
  userId INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  passwordHash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'operator', 'viewer') DEFAULT 'operator',
  fullName VARCHAR(255),
  isActive BOOLEAN DEFAULT TRUE,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lastLogin DATETIME NULL,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB;

INSERT INTO Users (username, email, passwordHash, role, fullName) VALUES
  ('admin', 'admin@warehouse.local', '$2b$10$rX8kZKxQ7LhXVZqF0qB6D.sJ7QhYzKpQhW1FvYxJQxVqJ7QhYzKpQ', 'admin', 'System Administrator'),
  ('operator', 'operator@warehouse.local', '$2b$10$rX8kZKxQ7LhXVZqF0qB6D.sJ7QhYzKpQhW1FvYxJQxVqJ7QhYzKpQ', 'operator', 'Skladník'),
  ('viewer', 'viewer@warehouse.local', '$2b$10$rX8kZKxQ7LhXVZqF0qB6D.sJ7QhYzKpQhW1FvYxJQxVqJ7QhYzKpQ', 'viewer', 'Prohlížeč')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  role = VALUES(role),
  fullName = VALUES(fullName);

-- Tabulka RefreshTokens
CREATE TABLE IF NOT EXISTS RefreshTokens (
  tokenId INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  token VARCHAR(500) NOT NULL UNIQUE,
  expiresAt DATETIME NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  isRevoked BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (userId) REFERENCES Users(userId) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user (userId)
) ENGINE=InnoDB;
