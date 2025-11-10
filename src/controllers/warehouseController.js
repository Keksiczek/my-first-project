const pool = require('../config/db');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');
const logger = require('../config/logger');

async function ensureWarehouseExists (warehouseId, executor = pool) {
  const runner = executor.query ? executor : pool;
  const [rows] = await runner.query(
    'SELECT * FROM warehouses WHERE warehouseId = ?',
    [warehouseId]
  );
  return rows[0];
}

exports.createWarehouse = async (req, res, next) => {
  const { name, type, location, capacity } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT warehouseId FROM warehouses WHERE name = ?',
      [name]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'Sklad se zadaným názvem již existuje'
      });
    }

    const [result] = await conn.query(
      `INSERT INTO warehouses (name, type, location, capacity)
       VALUES (?, ?, ?, ?)` ,
      [name, type || 'Main', location || null, capacity || null]
    );

    await conn.commit();

    const warehouse = await ensureWarehouseExists(result.insertId);

    logger.info('Warehouse created', { warehouseId: result.insertId, name });

    return res.status(201).json({
      success: true,
      message: 'Sklad vytvořen',
      data: warehouse
    });
  } catch (error) {
    await conn.rollback();
    return next(error);
  } finally {
    conn.release();
  }
};

exports.getWarehouses = async (req, res, next) => {
  const { page, limit, type, isActive, search } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  try {
    const filters = [];
    const aliasFilters = [];
    const params = [];

    if (type) {
      filters.push('type = ?');
      aliasFilters.push('w.type = ?');
      params.push(type);
    }

    if (typeof isActive !== 'undefined') {
      filters.push('isActive = ?');
      aliasFilters.push('w.isActive = ?');
      params.push(isActive === 'true' ? 1 : 0);
    }

    if (search) {
      filters.push('(name LIKE ? OR location LIKE ? )');
      aliasFilters.push('(w.name LIKE ? OR w.location LIKE ? )');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const aliasWhere = aliasFilters.length > 0 ? `WHERE ${aliasFilters.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM warehouses ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT w.*, COALESCE(SUM(i.qtyAvailable), 0) AS stockQuantity
         FROM warehouses w
         LEFT JOIN Inventory i ON i.warehouseId = w.warehouseId
         ${aliasWhere}
         GROUP BY w.warehouseId
         ORDER BY w.name
         LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    res.json(buildPaginatedResponse(rows, total, safePage, safeLimit));
  } catch (error) {
    next(error);
  }
};

exports.getWarehouseById = async (req, res, next) => {
  const { warehouseId } = req.params;

  try {
    const warehouse = await ensureWarehouseExists(warehouseId);

    if (!warehouse) {
      return res.status(404).json({
        success: false,
        message: 'Sklad nenalezen'
      });
    }

    const [positions] = await pool.query(
      `SELECT positionId, positionName, description, maxCapacity, currentContent, lastUpdated
         FROM warehousePositions
         WHERE warehouseId = ?
         ORDER BY positionName`,
      [warehouseId]
    );

    const [inventory] = await pool.query(
      `SELECT i.inventoryId, i.barcode, oi.itemName, i.position, i.qtyAvailable,
              i.dateUpdated
         FROM Inventory i
         LEFT JOIN OrderItems oi ON oi.barcode = i.barcode
         WHERE i.warehouseId = ?
         ORDER BY i.position`,
      [warehouseId]
    );

    res.json({
      success: true,
      data: {
        warehouse,
        positions,
        inventory
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateWarehouse = async (req, res, next) => {
  const { warehouseId } = req.params;
  const { name, type, location, capacity, isActive } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const warehouse = await ensureWarehouseExists(warehouseId, conn);

    if (!warehouse) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sklad nenalezen'
      });
    }

    const updates = [];
    const params = [];

    if (typeof name !== 'undefined') {
      updates.push('name = ?');
      params.push(name);
    }
    if (typeof type !== 'undefined') {
      updates.push('type = ?');
      params.push(type);
    }
    if (typeof location !== 'undefined') {
      updates.push('location = ?');
      params.push(location || null);
    }
    if (typeof capacity !== 'undefined') {
      updates.push('capacity = ?');
      params.push(capacity);
    }
    if (typeof isActive !== 'undefined') {
      updates.push('isActive = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Nejsou uvedena žádná data pro aktualizaci'
      });
    }

    params.push(warehouseId);

    await conn.query(
      `UPDATE warehouses SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE warehouseId = ?`,
      params
    );

    await conn.commit();

    const updatedWarehouse = await ensureWarehouseExists(warehouseId);

    logger.info('Warehouse updated', { warehouseId });

    res.json({
      success: true,
      message: 'Sklad aktualizován',
      data: updatedWarehouse
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.deactivateWarehouse = async (req, res, next) => {
  const { warehouseId } = req.params;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const warehouse = await ensureWarehouseExists(warehouseId);

    if (!warehouse) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Sklad nenalezen' });
    }

    const [[{ itemCount }]] = await conn.query(
      'SELECT COUNT(*) AS itemCount FROM Inventory WHERE warehouseId = ? AND qtyAvailable > 0',
      [warehouseId]
    );

    if (itemCount > 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Sklad obsahuje materiál a nelze jej deaktivovat'
      });
    }

    await conn.query(
      'UPDATE warehouses SET isActive = 0, updatedAt = CURRENT_TIMESTAMP WHERE warehouseId = ?',
      [warehouseId]
    );

    await conn.commit();

    logger.info('Warehouse deactivated', { warehouseId });

    res.json({ success: true, message: 'Sklad deaktivován' });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.getWarehousePositions = async (req, res, next) => {
  const { warehouseId } = req.query;
  const { page, limit } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  try {
    const filters = [];
    const params = [];

    if (warehouseId) {
      filters.push('wp.warehouseId = ?');
      params.push(warehouseId);
    }

    const where = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM warehousePositions wp ${where}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT wp.*, w.name AS warehouseName
         FROM warehousePositions wp
         JOIN warehouses w ON w.warehouseId = wp.warehouseId
         ${where}
         ORDER BY w.name, wp.positionName
         LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    res.json(buildPaginatedResponse(rows, total, safePage, safeLimit));
  } catch (error) {
    next(error);
  }
};

exports.createWarehousePosition = async (req, res, next) => {
  const { warehouseId, positionName, description, maxCapacity } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const warehouse = await ensureWarehouseExists(warehouseId);
    if (!warehouse) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Sklad nenalezen' });
    }

    const [existing] = await conn.query(
      `SELECT positionId FROM warehousePositions WHERE warehouseId = ? AND positionName = ?`,
      [warehouseId, positionName]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ success: false, message: 'Pozice již existuje' });
    }

    const [result] = await conn.query(
      `INSERT INTO warehousePositions (warehouseId, positionName, description, maxCapacity)
       VALUES (?, ?, ?, ?)` ,
      [warehouseId, positionName, description || null, maxCapacity || null]
    );

    await conn.commit();

    const [positionRows] = await pool.query(
      'SELECT * FROM warehousePositions WHERE positionId = ?',
      [result.insertId]
    );

    logger.info('Warehouse position created', { warehouseId, positionId: result.insertId });

    res.status(201).json({ success: true, data: positionRows[0] });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.getVacantPositions = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT wp.positionId, wp.positionName, wp.maxCapacity, wp.currentContent,
              w.warehouseId, w.name AS warehouseName
         FROM warehousePositions wp
         JOIN warehouses w ON w.warehouseId = wp.warehouseId
         WHERE (wp.currentContent IS NULL OR wp.currentContent = '')
            OR (wp.maxCapacity IS NOT NULL AND wp.maxCapacity > 0)
         ORDER BY w.name, wp.positionName`
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
