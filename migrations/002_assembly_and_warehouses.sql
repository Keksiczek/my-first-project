-- =====================================================
-- TABULKA: Warehouses - Správa skladů
-- =====================================================
CREATE TABLE IF NOT EXISTS Warehouses (
  warehouseId VARCHAR(50) PRIMARY KEY,
  warehouseName VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  capacity INT,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  dateCreated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  INDEX idx_warehouses_active (isActive)
) ENGINE=InnoDB;

-- Vzorové sklady
INSERT INTO Warehouses (warehouseId, warehouseName, location, capacity)
VALUES 
  ('SKLAD-A', 'Hlavní sklad', 'Hala 1', 10000),
  ('SKLAD-B', 'Pomocný sklad', 'Hala 2', 5000),
  ('MONTAZ-1', 'Montážní prostor', 'Výroba', 2000)
ON DUPLICATE KEY UPDATE warehouseName = VALUES(warehouseName);

-- =====================================================
-- ROZŠÍŘENÍ: Orders - Přidání podpory pro assembly
-- =====================================================
ALTER TABLE Orders
  ADD COLUMN orderType ENUM('zakazka', 'podmontaz') NOT NULL DEFAULT 'zakazka',
  ADD COLUMN parentOrderId INT NULL,
  ADD COLUMN assemblyStatus ENUM('pending', 'in_progress', 'completed', 'quality_check', 'approved', 'rejected') 
      NOT NULL DEFAULT 'pending',
  ADD COLUMN dateStarted DATETIME NULL,
  ADD COLUMN dateCompleted DATETIME NULL,
  ADD COLUMN operator VARCHAR(100) NULL,
  ADD CONSTRAINT fk_orders_parent
    FOREIGN KEY (parentOrderId) REFERENCES Orders(orderId)
    ON DELETE CASCADE;

-- Indexy
CREATE INDEX idx_orders_parent ON Orders(parentOrderId);
CREATE INDEX idx_orders_type ON Orders(orderType);
CREATE INDEX idx_orders_assembly_status ON Orders(assemblyStatus);

-- =====================================================
-- TABULKA: OrderComponents - Komponenty zakázky
-- =====================================================
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

-- =====================================================
-- TABULKA: AssemblyReports - Reporting zakázek
-- =====================================================
CREATE TABLE IF NOT EXISTS AssemblyReports (
  reportId INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  reportType ENUM('start', 'progress', 'complete', 'quality', 'status_change') NOT NULL,
  operator VARCHAR(100),
  previousStatus VARCHAR(50),
  newStatus VARCHAR(50),
  workDuration INT COMMENT 'Doba práce v minutách',
  notes TEXT,
  dateCreated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reports_order
    FOREIGN KEY (orderId) REFERENCES Orders(orderId)
    ON DELETE CASCADE,
  INDEX idx_reports_order (orderId),
  INDEX idx_reports_type (reportType),
  INDEX idx_reports_date (dateCreated)
) ENGINE=InnoDB;

-- =====================================================
-- TABULKA: QualityChecks - Kontrola kvality
-- =====================================================
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

-- =====================================================
-- TABULKA: AuditLog - Historie změn
-- =====================================================
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

-- =====================================================
-- AKTUALIZACE: Inventory - FK na Warehouses
-- =====================================================
ALTER TABLE Inventory
  ADD CONSTRAINT fk_inventory_warehouse
    FOREIGN KEY (warehouseId) REFERENCES Warehouses(warehouseId)
    ON DELETE RESTRICT;

-- =====================================================
-- AKTUALIZACE: Movements - Tracking assembly
-- =====================================================
ALTER TABLE Movements
  ADD COLUMN orderId INT NULL,
  ADD CONSTRAINT fk_movements_order
    FOREIGN KEY (orderId) REFERENCES Orders(orderId)
    ON DELETE SET NULL;
