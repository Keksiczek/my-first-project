const pool = require('../config/db');
const logger = require('../config/logger');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');
const { buildSubProductPayload } = require('../services/productionService');

exports.createSubProduct = async (req, res, next) => {
  const payload = req.body;

  try {
    const data = buildSubProductPayload(payload);

    const [result] = await pool.query(
      `INSERT INTO subProducts (
         parentWorkOrderId, parentStageId, componentCode, componentName,
         quantity, unit, currentStageId, warehouseId, position, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        data.parentWorkOrderId,
        data.parentStageId,
        data.componentCode,
        data.componentName,
        data.quantity,
        data.unit,
        data.currentStageId,
        data.warehouseId,
        data.position,
        data.status
      ]
    );

    const [rows] = await pool.query(
      'SELECT * FROM subProducts WHERE subProductId = ?',
      [result.insertId]
    );

    logger.info('Sub product created', { subProductId: result.insertId });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.listSubProducts = async (req, res, next) => {
  const { status, warehouseId, stageId } = req.query;
  const { page, limit } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  try {
    const filters = [];
    const params = [];

    if (status) {
      filters.push('sp.status = ?');
      params.push(status);
    }
    if (warehouseId) {
      filters.push('sp.warehouseId = ?');
      params.push(warehouseId);
    }
    if (stageId) {
      filters.push('sp.currentStageId = ?');
      params.push(stageId);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM subProducts sp ${whereClause}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT sp.*, w.name AS warehouseName, ps.stageName
         FROM subProducts sp
         LEFT JOIN warehouses w ON w.warehouseId = sp.warehouseId
         LEFT JOIN productionStages ps ON ps.stageId = sp.currentStageId
         ${whereClause}
         ORDER BY sp.updatedAt DESC
         LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    res.json(buildPaginatedResponse(rows, total, safePage, safeLimit));
  } catch (error) {
    next(error);
  }
};

exports.getSubProduct = async (req, res, next) => {
  const { subProductId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT sp.*, w.name AS warehouseName, ps.stageName
         FROM subProducts sp
         LEFT JOIN warehouses w ON w.warehouseId = sp.warehouseId
         LEFT JOIN productionStages ps ON ps.stageId = sp.currentStageId
         WHERE sp.subProductId = ?`,
      [subProductId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meziprodukt nenalezen' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.moveSubProduct = async (req, res, next) => {
  const { subProductId } = req.params;
  const { warehouseId, position, currentStageId, status } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM subProducts WHERE subProductId = ? FOR UPDATE',
      [subProductId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Meziprodukt nenalezen' });
    }

    const updates = [];
    const params = [];

    if (typeof warehouseId !== 'undefined') {
      updates.push('warehouseId = ?');
      params.push(warehouseId || null);
    }
    if (typeof position !== 'undefined') {
      updates.push('position = ?');
      params.push(position || null);
    }
    if (typeof currentStageId !== 'undefined') {
      updates.push('currentStageId = ?');
      params.push(currentStageId || null);
    }
    if (typeof status !== 'undefined') {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Nejsou uvedena žádná data pro přesun' });
    }

    params.push(subProductId);

    await conn.query(
      `UPDATE subProducts SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE subProductId = ?`,
      params
    );

    await conn.commit();

    const [updated] = await pool.query(
      'SELECT * FROM subProducts WHERE subProductId = ?',
      [subProductId]
    );

    logger.info('Sub product moved', { subProductId });

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.getWorkOrderSubProducts = async (req, res, next) => {
  const { workOrderId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT sp.*, w.name AS warehouseName, ps.stageName
         FROM subProducts sp
         LEFT JOIN warehouses w ON w.warehouseId = sp.warehouseId
         LEFT JOIN productionStages ps ON ps.stageId = sp.currentStageId
         WHERE sp.parentWorkOrderId = ?
         ORDER BY sp.createdAt`,
      [workOrderId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
