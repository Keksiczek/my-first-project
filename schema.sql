-- Vytvoření databáze
CREATE DATABASE IF NOT EXISTS warehouse_system
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE warehouse_system;

-- -----------------------------------------------------
-- Uživatelské účty a role (nutné pro RBAC)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  userId INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(150) NOT NULL UNIQUE,
  passwordHash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'operator', 'operator_limited', 'viewer') NOT NULL DEFAULT 'viewer',
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  lastLogin TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Sklady a skladové pozice (multi-warehouse podpora)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
  warehouseId INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type ENUM('Main', 'Buffer', 'WIP', 'Finished') DEFAULT 'Main',
  location VARCHAR(255),
  capacity INT,
  currentUsage INT DEFAULT 0,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS warehousePositions (
  positionId INT AUTO_INCREMENT PRIMARY KEY,
  warehouseId INT NOT NULL,
  positionName VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  maxCapacity INT,
  currentContent VARCHAR(500),
  lastUpdated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  UNIQUE KEY unique_warehouse_position (warehouseId, positionName)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS machines (
  machineId INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(50),
  serialNumber VARCHAR(100),
  location VARCHAR(100),
  status ENUM('operational', 'maintenance', 'broken', 'offline') DEFAULT 'operational',
  lastMaintenance TIMESTAMP NULL,
  nextMaintenanceSchedule TIMESTAMP NULL,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabulka Orders
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Orders (
  orderId      INT AUTO_INCREMENT PRIMARY KEY,
  sapNumber    VARCHAR(10) NOT NULL UNIQUE,
  orderQR      VARCHAR(50) NOT NULL UNIQUE,
  supplier     VARCHAR(255) NOT NULL,
  dateCreated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status       VARCHAR(50) NOT NULL DEFAULT 'pending',
  notes        TEXT NULL,
  orderType ENUM('zakazka', 'podmontaz') NOT NULL DEFAULT 'zakazka',
  parentOrderId INT NULL,
  assemblyStatus ENUM('pending', 'in_progress', 'completed', 'quality_check', 'approved', 'rejected')
      NOT NULL DEFAULT 'pending',
  dateStarted DATETIME NULL,
  dateCompleted DATETIME NULL,
  operator VARCHAR(100) NULL,
  CONSTRAINT fk_orders_parent
    FOREIGN KEY (parentOrderId) REFERENCES Orders(orderId)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_orders_parent ON Orders(parentOrderId);
CREATE INDEX idx_orders_type ON Orders(orderType);
CREATE INDEX idx_orders_assembly_status ON Orders(assemblyStatus);

-- -----------------------------------------------------
-- Tabulka OrderItems
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS OrderItems (
  itemId       INT AUTO_INCREMENT PRIMARY KEY,
  orderId      INT NOT NULL,
  warehouseId  INT NULL,
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
  CONSTRAINT fk_orderitems_warehouse
    FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId)
    ON DELETE SET NULL,
  INDEX idx_orderitems_orderId (orderId),
  INDEX idx_orderitems_barcode (barcode)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabulka Inventory
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Inventory (
  inventoryId  INT AUTO_INCREMENT PRIMARY KEY,
  barcode      VARCHAR(50) NOT NULL,
  warehouseId  INT NULL,
  position     VARCHAR(50) NOT NULL,
  qtyAvailable INT NOT NULL DEFAULT 0,
  dateAdded    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dateUpdated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_barcode
    FOREIGN KEY (barcode) REFERENCES OrderItems(barcode)
    ON DELETE CASCADE,
  CONSTRAINT fk_inventory_warehouse_entity
    FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId)
    ON DELETE SET NULL,
  CONSTRAINT uk_inventory_location UNIQUE (barcode, warehouseId, position),
  INDEX idx_inventory_barcode (barcode),
  INDEX idx_inventory_location (warehouseId, position)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabulka Movements
-- -----------------------------------------------------
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
  orderId       INT NULL,
  CONSTRAINT fk_movements_barcode
    FOREIGN KEY (barcode) REFERENCES OrderItems(barcode)
    ON DELETE CASCADE,
  CONSTRAINT fk_movements_order
    FOREIGN KEY (orderId) REFERENCES Orders(orderId)
    ON DELETE SET NULL,
  INDEX idx_movements_barcode (barcode),
  INDEX idx_movements_type (movementType),
  INDEX idx_movements_date (dateCreated)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Assembly & Quality tabulky z předchozích migrací
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS OrderComponents (
  componentId INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  componentType ENUM('order', 'item') NOT NULL,
  componentOrderId INT NULL,
  componentItemId INT NULL,
  quantityRequired INT NOT NULL DEFAULT 1,
  quantityUsed INT NOT NULL DEFAULT 0,
  sortOrder INT NOT NULL DEFAULT 0,
  dateAdded DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_components_order
    FOREIGN KEY (orderId) REFERENCES Orders(orderId)
    ON DELETE CASCADE,
  CONSTRAINT fk_components_child_order
    FOREIGN KEY (componentOrderId) REFERENCES Orders(orderId)
    ON DELETE CASCADE,
  CONSTRAINT fk_components_item
    FOREIGN KEY (componentItemId) REFERENCES OrderItems(itemId)
    ON DELETE CASCADE,
  INDEX idx_components_order (orderId),
  INDEX idx_components_type (componentType)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS AssemblyReports (
  reportId INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  reportType ENUM('start', 'progress', 'complete', 'quality', 'status_change') NOT NULL,
  operator VARCHAR(100),
  previousStatus VARCHAR(50),
  newStatus VARCHAR(50),
  workDuration INT,
  notes TEXT,
  dateCreated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_order
    FOREIGN KEY (orderId) REFERENCES Orders(orderId)
    ON DELETE CASCADE,
  INDEX idx_reports_order (orderId),
  INDEX idx_reports_type (reportType),
  INDEX idx_reports_date (dateCreated)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS QualityChecks (
  checkId INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  result ENUM('OK', 'NOK') NOT NULL,
  inspector VARCHAR(100) NOT NULL,
  dateChecked DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  parameters JSON NULL,
  CONSTRAINT fk_quality_order
    FOREIGN KEY (orderId) REFERENCES Orders(orderId)
    ON DELETE CASCADE,
  INDEX idx_quality_order (orderId),
  INDEX idx_quality_result (result),
  INDEX idx_quality_date (dateChecked)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS AuditLog (
  logId INT AUTO_INCREMENT PRIMARY KEY,
  tableName VARCHAR(50) NOT NULL,
  recordId INT NOT NULL,
  action ENUM('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE') NOT NULL,
  userId VARCHAR(100),
  oldValue JSON,
  newValue JSON,
  dateCreated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_table (tableName, recordId),
  INDEX idx_audit_date (dateCreated)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Výrobní dávky, mezioperace a kvalita (nové)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS production (
  workOrderId INT AUTO_INCREMENT PRIMARY KEY,
  productCode VARCHAR(100) NOT NULL,
  batchNumber VARCHAR(50) UNIQUE,
  orderId INT,
  quantityIn INT NOT NULL,
  quantityOut INT DEFAULT 0,
  quantityScrap INT DEFAULT 0,
  startTime TIMESTAMP NULL,
  endTime TIMESTAMP NULL,
  status ENUM('pending', 'started', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  operatorId INT,
  machineId VARCHAR(50),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (orderId) REFERENCES Orders(orderId),
  FOREIGN KEY (operatorId) REFERENCES users(userId),
  INDEX idx_status (status),
  INDEX idx_batchNumber (batchNumber)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS productionStages (
  stageId INT AUTO_INCREMENT PRIMARY KEY,
  workOrderId INT NOT NULL,
  stageSequence INT NOT NULL,
  stageName VARCHAR(100) NOT NULL,
  stageDescription VARCHAR(255),
  machineId VARCHAR(50),
  machineType VARCHAR(100),
  inputQuantity INT NOT NULL,
  outputQuantity INT DEFAULT 0,
  scrapQuantity INT DEFAULT 0,
  reworkQuantity INT DEFAULT 0,
  startTime TIMESTAMP NULL,
  endTime TIMESTAMP NULL,
  plannedDuration INT,
  actualDuration INT,
  operatorId INT,
  quality_ok INT DEFAULT 0,
  quality_nok INT DEFAULT 0,
  status ENUM('pending', 'started', 'in_progress', 'completed', 'paused') DEFAULT 'pending',
  nextStageId INT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workOrderId) REFERENCES production(workOrderId),
  FOREIGN KEY (operatorId) REFERENCES users(userId),
  FOREIGN KEY (nextStageId) REFERENCES productionStages(stageId),
  INDEX idx_workOrderId (workOrderId),
  INDEX idx_stageSequence (workOrderId, stageSequence),
  INDEX idx_stage_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS subProducts (
  subProductId INT AUTO_INCREMENT PRIMARY KEY,
  parentWorkOrderId INT NOT NULL,
  parentStageId INT,
  componentCode VARCHAR(100) UNIQUE,
  componentName VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit VARCHAR(20) DEFAULT 'ks',
  currentStageId INT,
  warehouseId INT,
  position VARCHAR(50),
  status ENUM('created', 'in_stock', 'in_progress', 'consumed') DEFAULT 'created',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parentWorkOrderId) REFERENCES production(workOrderId),
  FOREIGN KEY (parentStageId) REFERENCES productionStages(stageId),
  FOREIGN KEY (currentStageId) REFERENCES productionStages(stageId),
  FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId),
  INDEX idx_parentWorkOrderId (parentWorkOrderId),
  INDEX idx_subproduct_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS productionStageLogs (
  logId INT AUTO_INCREMENT PRIMARY KEY,
  stageId INT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  eventType ENUM('started', 'paused', 'resumed', 'completed', 'quality_check', 'rework_issued') DEFAULT 'started',
  quantity INT,
  duration INT,
  operatorId INT,
  machineDowntime INT DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (stageId) REFERENCES productionStages(stageId),
  FOREIGN KEY (operatorId) REFERENCES users(userId),
  INDEX idx_stageId (stageId),
  INDEX idx_stage_timestamp (timestamp)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS qualityChecks (
  checkId INT AUTO_INCREMENT PRIMARY KEY,
  stageId INT NOT NULL,
  subProductId INT,
  checkType VARCHAR(100),
  result ENUM('OK', 'NOK', 'rework') DEFAULT 'OK',
  parameter VARCHAR(100),
  specMin DECIMAL(10,2),
  specMax DECIMAL(10,2),
  measured DECIMAL(10,2),
  notes TEXT,
  checkedBy INT,
  checkedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stageId) REFERENCES productionStages(stageId),
  FOREIGN KEY (subProductId) REFERENCES subProducts(subProductId),
  FOREIGN KEY (checkedBy) REFERENCES users(userId),
  INDEX idx_quality_stage (stageId),
  INDEX idx_quality_result (result)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Vzorová data
-- -----------------------------------------------------
INSERT INTO warehouses (warehouseId, name, type, location, capacity)
VALUES
  (1, 'Hlavní sklad', 'Main', 'Hala 1', 10000),
  (2, 'Buffer sklad', 'Buffer', 'Hala 2', 5000),
  (3, 'Výroba WIP', 'WIP', 'Výroba', 2000)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  type = VALUES(type),
  location = VALUES(location),
  capacity = VALUES(capacity),
  isActive = TRUE;

INSERT INTO Orders (sapNumber, orderQR, supplier, status, notes)
VALUES ('4500123456', 'ORD-4500123456-251107', 'Kovar s.r.o.', 'pending', '')
ON DUPLICATE KEY UPDATE supplier = VALUES(supplier);

SET @orderId := (SELECT orderId FROM Orders WHERE sapNumber = '4500123456');

INSERT INTO OrderItems (
  orderId, warehouseId, barcode, itemName, quantity, dimension, material, position, qtyReceived, status
) VALUES
  (@orderId, 1, 'MAT-251107-001', 'Plech 2mm', 10, 'd60x463', 'Cf 53', 'B2', 0, 'pending')
ON DUPLICATE KEY UPDATE itemName = VALUES(itemName);

INSERT INTO OrderItems (
  orderId, warehouseId, barcode, itemName, quantity, dimension, material, position, qtyReceived, status
) VALUES
  (@orderId, 2, 'MAT-251107-002', 'Šroub M6', 50, 'M6x20', 'Ocel', 'C1', 0, 'pending')
ON DUPLICATE KEY UPDATE itemName = VALUES(itemName);

INSERT INTO Inventory (barcode, warehouseId, position, qtyAvailable)
VALUES ('MAT-251107-001', 1, 'B2', 10)
ON DUPLICATE KEY UPDATE qtyAvailable = VALUES(qtyAvailable);

INSERT INTO Movements (barcode, movementType, toWarehouse, toPosition, quantity, notes)
VALUES ('MAT-251107-001', 'receive', '1', 'B2', 10, 'Testovací příjem')
ON DUPLICATE KEY UPDATE notes = VALUES(notes);
