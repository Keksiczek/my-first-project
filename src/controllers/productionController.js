const pool = require('../config/db');
const logger = require('../config/logger');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');
const { buildProductionInsert } = require('../services/productionService');

exports.startProduction = async (req, res, next) => {
  const payload = req.body;
  const operatorId = req.user?.userId || payload.operatorId;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const insertData = buildProductionInsert(payload, operatorId);
    const [result] = await conn.query(
      `INSERT INTO production
         (productCode, batchNumber, orderId, quantityIn, status, operatorId, machineId, notes, startTime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        insertData.productCode,
        insertData.batchNumber,
        insertData.orderId,
        insertData.quantityIn,
        insertData.status,
        insertData.operatorId,
        insertData.machineId,
        insertData.notes,
        insertData.startTime
      ]
    );

    const workOrderId = result.insertId;

    if (Array.isArray(payload.stages) && payload.stages.length > 0) {
      const stageValues = payload.stages.map((stage, index) => [
        workOrderId,
        stage.stageSequence || index + 1,
        stage.stageName,
        stage.stageDescription || null,
        stage.machineId || null,
        stage.machineType || null,
        stage.inputQuantity || insertData.quantityIn,
        stage.outputQuantity || 0,
        stage.scrapQuantity || 0,
        stage.reworkQuantity || 0,
        null,
        null,
        stage.plannedDuration || null,
        null,
        stage.operatorId || insertData.operatorId || null,
        0,
        0,
        'pending',
        stage.nextStageId || null,
        stage.notes || null
      ]);

      await conn.query(
        `INSERT INTO productionStages (
           workOrderId, stageSequence, stageName, stageDescription,
           machineId, machineType, inputQuantity, outputQuantity,
           scrapQuantity, reworkQuantity, startTime, endTime,
           plannedDuration, actualDuration, operatorId,
           quality_ok, quality_nok, status, nextStageId, notes
         ) VALUES ?`,
        [stageValues]
      );
    }

    const [productionRows] = await conn.query(
      'SELECT * FROM production WHERE workOrderId = ?',
      [workOrderId]
    );

    await conn.commit();

    logger.info('Production batch started', { workOrderId });

    res.status(201).json({ success: true, data: productionRows[0] });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.listProduction = async (req, res, next) => {
  const { status, productCode, batchNumber, from, to } = req.query;
  const { page, limit } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  try {
    const filters = [];
    const params = [];

    if (status) {
      filters.push('p.status = ?');
      params.push(status);
    }
    if (productCode) {
      filters.push('p.productCode LIKE ?');
      params.push(`%${productCode}%`);
    }
    if (batchNumber) {
      filters.push('p.batchNumber LIKE ?');
      params.push(`%${batchNumber}%`);
    }
    if (from) {
      filters.push('p.startTime >= ?');
      params.push(from);
    }
    if (to) {
      filters.push('p.startTime <= ?');
      params.push(to);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM production p ${whereClause}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT p.*, COALESCE(SUM(ps.outputQuantity), 0) AS totalOutput,
              COALESCE(SUM(ps.scrapQuantity), 0) AS totalScrap
         FROM production p
         LEFT JOIN productionStages ps ON ps.workOrderId = p.workOrderId
         ${whereClause}
         GROUP BY p.workOrderId
         ORDER BY p.startTime DESC
         LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    res.json(buildPaginatedResponse(rows, total, safePage, safeLimit));
  } catch (error) {
    next(error);
  }
};

exports.getProductionDetail = async (req, res, next) => {
  const { workOrderId } = req.params;

  try {
    const [productionRows] = await pool.query(
      'SELECT * FROM production WHERE workOrderId = ?',
      [workOrderId]
    );

    if (productionRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Výrobní dávka nenalezena' });
    }

    const [stages] = await pool.query(
      `SELECT ps.*, COUNT(q.checkId) AS qualityChecks
         FROM productionStages ps
         LEFT JOIN qualityChecks q ON q.stageId = ps.stageId
         WHERE ps.workOrderId = ?
         GROUP BY ps.stageId
         ORDER BY ps.stageSequence`,
      [workOrderId]
    );

    const [stageLogs] = await pool.query(
      `SELECT * FROM productionStageLogs WHERE stageId IN (
           SELECT stageId FROM productionStages WHERE workOrderId = ?
         ) ORDER BY timestamp`,
      [workOrderId]
    );

    const [subProducts] = await pool.query(
      'SELECT * FROM subProducts WHERE parentWorkOrderId = ? ORDER BY createdAt',
      [workOrderId]
    );

    const [quality] = await pool.query(
      `SELECT result, COUNT(*) AS count FROM qualityChecks
         WHERE stageId IN (SELECT stageId FROM productionStages WHERE workOrderId = ?)
         GROUP BY result`,
      [workOrderId]
    );

    res.json({
      success: true,
      data: {
        production: productionRows[0],
        stages,
        stageLogs,
        subProducts,
        quality
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProduction = async (req, res, next) => {
  const { workOrderId } = req.params;
  const { status, quantityOut, quantityScrap, machineId, notes, endTime } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [productionRows] = await conn.query(
      'SELECT * FROM production WHERE workOrderId = ? FOR UPDATE',
      [workOrderId]
    );

    if (productionRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Výrobní dávka nenalezena' });
    }

    const updates = [];
    const params = [];

    if (typeof status !== 'undefined') {
      updates.push('status = ?');
      params.push(status);
    }
    if (typeof quantityOut !== 'undefined') {
      if (quantityOut < 0) {
        throw new Error('Výstupní množství musí být nezáporné');
      }
      updates.push('quantityOut = ?');
      params.push(quantityOut);
    }
    if (typeof quantityScrap !== 'undefined') {
      if (quantityScrap < 0) {
        throw new Error('Zmetkovitost musí být nezáporná');
      }
      updates.push('quantityScrap = ?');
      params.push(quantityScrap);
    }
    if (typeof machineId !== 'undefined') {
      updates.push('machineId = ?');
      params.push(machineId || null);
    }
    if (typeof notes !== 'undefined') {
      updates.push('notes = ?');
      params.push(notes || null);
    }
    if (typeof endTime !== 'undefined') {
      updates.push('endTime = ?');
      params.push(endTime || null);
    } else if (status === 'completed' && !productionRows[0].endTime) {
      updates.push('endTime = NOW()');
    }

    if (updates.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Nejsou uvedena žádná data pro aktualizaci' });
    }

    params.push(workOrderId);

    await conn.query(
      `UPDATE production SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE workOrderId = ?`,
      params
    );

    await conn.commit();

    const [updatedRows] = await pool.query(
      'SELECT * FROM production WHERE workOrderId = ?',
      [workOrderId]
    );

    logger.info('Production batch updated', { workOrderId });

    res.json({ success: true, data: updatedRows[0] });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};
