-- =====================================================
-- TABULKA: Users - správa uživatelů a rolí
-- =====================================================
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

-- Výchozí uživatelé (heslo: Admin123!)
INSERT INTO Users (username, email, passwordHash, role, fullName) VALUES
  ('admin', 'admin@warehouse.local', '$2b$10$rX8kZKxQ7LhXVZqF0qB6D.sJ7QhYzKpQhW1FvYxJQxVqJ7QhYzKpQ', 'admin', 'System Administrator'),
  ('operator', 'operator@warehouse.local', '$2b$10$rX8kZKxQ7LhXVZqF0qB6D.sJ7QhYzKpQhW1FvYxJQxVqJ7QhYzKpQ', 'operator', 'Skladník'),
  ('viewer', 'viewer@warehouse.local', '$2b$10$rX8kZKxQ7LhXVZqF0qB6D.sJ7QhYzKpQhW1FvYxJQxVqJ7QhYzKpQ', 'viewer', 'Prohlížeč')
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  role = VALUES(role),
  fullName = VALUES(fullName);

-- =====================================================
-- TABULKA: RefreshTokens - správa obnovovacích tokenů
-- =====================================================
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
