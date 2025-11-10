-- =====================================================
-- Migrace 003: Výrobní moduly, multi-sklady a kvalita
-- =====================================================

START TRANSACTION;

-- Uživatelská tabulka pro RBAC (pokud ještě neexistuje)
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

-- Nová tabulka skladů podle specifikace
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

-- Přenos původních skladů (pokud existuje tabulka Warehouses)
INSERT INTO warehouses (name, type, location, capacity, currentUsage, isActive)
SELECT w.warehouseName, 'Main', w.location, w.capacity, 0, w.isActive
FROM Warehouses w
WHERE NOT EXISTS (
  SELECT 1 FROM warehouses newW WHERE newW.name = w.warehouseName
);

-- Skladové pozice
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

-- Stroje
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

-- Rozšíření OrderItems o vazbu na nový sklad
ALTER TABLE OrderItems
  ADD COLUMN IF NOT EXISTS warehouseId INT NULL AFTER orderId;

ALTER TABLE OrderItems
  ADD CONSTRAINT fk_orderitems_warehouse
    FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId)
    ON DELETE SET NULL;

-- Úprava Inventory: převod na nový integer warehouseId
SET @has_fk := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_NAME = 'fk_inventory_warehouse'
    AND TABLE_NAME = 'Inventory' AND TABLE_SCHEMA = DATABASE()
);

SET @drop_fk_sql := IF(@has_fk = 1, 'ALTER TABLE Inventory DROP FOREIGN KEY fk_inventory_warehouse;', 'SELECT 1;');
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_legacy_column := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'Inventory'
    AND COLUMN_NAME = 'warehouseId'
    AND DATA_TYPE <> 'int'
);

SET @rename_column_sql := IF(
  @has_legacy_column = 1,
  'ALTER TABLE Inventory CHANGE COLUMN warehouseId warehouseCode VARCHAR(50) NULL;',
  'SELECT 1;'
);
PREPARE stmt FROM @rename_column_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE Inventory
  ADD COLUMN IF NOT EXISTS warehouseId INT NULL AFTER barcode;

-- Naplnění nového warehouseId dle původního kódu
UPDATE Inventory i
LEFT JOIN Warehouses wOld ON wOld.warehouseId = i.warehouseCode
LEFT JOIN warehouses wNew ON wNew.name = wOld.warehouseName
SET i.warehouseId = wNew.warehouseId
WHERE wNew.warehouseId IS NOT NULL;

ALTER TABLE Inventory
  DROP INDEX IF EXISTS uk_inventory_location;

ALTER TABLE Inventory
  ADD CONSTRAINT uk_inventory_location UNIQUE (barcode, warehouseId, position);

ALTER TABLE Inventory
  ADD CONSTRAINT fk_inventory_warehouse_entity
    FOREIGN KEY (warehouseId) REFERENCES warehouses(warehouseId)
    ON DELETE SET NULL;

SET @drop_legacy_column_sql := IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Inventory' AND COLUMN_NAME = 'warehouseCode'),
  'ALTER TABLE Inventory DROP COLUMN warehouseCode;',
  'SELECT 1;'
);
PREPARE stmt FROM @drop_legacy_column_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Výrobní tabulky
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

COMMIT;
