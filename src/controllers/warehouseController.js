// ZMĚNA: Controller pro správu skladů s transakcemi a logováním
const pool = require('../config/db');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');
const logger = require('../config/logger');

exports.createWarehouse = async (req, res, next) => {
  const { warehouseId, warehouseName, location, capacity, notes } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT warehouseId FROM Warehouses WHERE warehouseId = ?',
      [warehouseId]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'Sklad s tímto ID již existuje'
      });
    }

    await conn.query(
      `INSERT INTO Warehouses (warehouseId, warehouseName, location, capacity, notes)
       VALUES (?, ?, ?, ?, ?)` ,
      [warehouseId, warehouseName, location || null, capacity || null, notes || null]
    );

    await conn.commit();

    const [rows] = await conn.query(
      'SELECT * FROM Warehouses WHERE warehouseId = ?',
      [warehouseId]
    );

    logger.info('Warehouse created', { warehouseId });

    return res.status(201).json({
      success: true,
      message: 'Sklad vytvořen',
      data: rows[0]
    });
  } catch (error) {
    await conn.rollback();
    return next(error);
  } finally {
    conn.release();
  }
};

exports.getWarehouses = async (req, res, next) => {
  const { page, limit, active } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  try {
    let whereClause = 'WHERE 1 = 1';
    const params = [];

    if (typeof active !== 'undefined') {
      whereClause += ' AND isActive = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    const countSql = `SELECT COUNT(*) AS total FROM Warehouses ${whereClause}`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT warehouseId, warehouseName, location, capacity, isActive, dateCreated, notes
      FROM Warehouses
      ${whereClause}
      ORDER BY warehouseName
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataSql, [...params, safeLimit, offset]);

    res.json(buildPaginatedResponse(rows, total, safePage, safeLimit));
  } catch (error) {
    next(error);
  }
};

exports.getWarehouseById = async (req, res, next) => {
  const { warehouseId } = req.params;

  try {
    const [warehouseRows] = await pool.query(
      'SELECT * FROM Warehouses WHERE warehouseId = ?',
      [warehouseId]
    );

    if (warehouseRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sklad nenalezen'
      });
    }

    const [inventoryRows] = await pool.query(
      `SELECT i.barcode, oi.itemName, i.position, i.qtyAvailable, i.dateUpdated
         FROM Inventory i
         LEFT JOIN OrderItems oi ON oi.barcode = i.barcode
         WHERE i.warehouseId = ?
         ORDER BY i.position`,
      [warehouseId]
    );

    res.json({
      success: true,
      data: {
        warehouse: warehouseRows[0],
        inventory: inventoryRows
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateWarehouse = async (req, res, next) => {
  const { warehouseId } = req.params;
  const { warehouseName, location, capacity, notes, isActive } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.query(
      'SELECT * FROM Warehouses WHERE warehouseId = ?',
      [warehouseId]
    );

    if (existingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sklad nenalezen'
      });
    }

    const updates = [];
    const params = [];

    if (typeof warehouseName !== 'undefined') {
      updates.push('warehouseName = ?');
      params.push(warehouseName);
    }
    if (typeof location !== 'undefined') {
      updates.push('location = ?');
      params.push(location || null);
    }
    if (typeof capacity !== 'undefined') {
      updates.push('capacity = ?');
      params.push(capacity);
    }
    if (typeof notes !== 'undefined') {
      updates.push('notes = ?');
      params.push(notes || null);
    }
    if (typeof isActive !== 'undefined') {
      updates.push('isActive = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Žádná data k aktualizaci'
      });
    }

    params.push(warehouseId);

    await conn.query(
      `UPDATE Warehouses SET ${updates.join(', ')} WHERE warehouseId = ?`,
      params
    );

    await conn.commit();

    const [updatedRows] = await conn.query(
      'SELECT * FROM Warehouses WHERE warehouseId = ?',
      [warehouseId]
    );

    logger.info('Warehouse updated', { warehouseId });

    res.json({
      success: true,
      message: 'Sklad aktualizován',
      data: updatedRows[0]
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

    const [warehouseRows] = await conn.query(
      'SELECT * FROM Warehouses WHERE warehouseId = ?',
      [warehouseId]
    );

    if (warehouseRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sklad nenalezen'
      });
    }

    const [inventoryRows] = await conn.query(
      'SELECT SUM(qtyAvailable) AS totalQty FROM Inventory WHERE warehouseId = ?',
      [warehouseId]
    );

    if ((inventoryRows[0]?.totalQty || 0) > 0) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Sklad nelze deaktivovat, protože obsahuje materiál'
      });
    }

    await conn.query(
      'UPDATE Warehouses SET isActive = 0 WHERE warehouseId = ?',
      [warehouseId]
    );

    await conn.commit();

    logger.info('Warehouse deactivated', { warehouseId });

    res.json({
      success: true,
      message: 'Sklad deaktivován'
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};
