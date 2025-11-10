const pool = require('../config/db');
const logger = require('../config/logger');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');
const { updateQualityCounters } = require('../services/productionService');

async function getStage (stageId, conn = pool) {
  const runner = conn.query ? conn : pool;
  const [rows] = await runner.query('SELECT * FROM productionStages WHERE stageId = ?', [stageId]);
  return rows[0];
}

exports.createQualityCheck = async (req, res, next) => {
  const { stageId, subProductId, checkType, result, parameter, specMin, specMax, measured, notes } = req.body;
  const operatorId = req.user?.userId || req.body.checkedBy || null;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const stage = await getStage(stageId, conn);
    if (!stage) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Mezioperace nenalezena' });
    }

    const [resultInsert] = await conn.query(
      `INSERT INTO qualityChecks (
         stageId, subProductId, checkType, result,
         parameter, specMin, specMax, measured, notes, checkedBy
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [stageId, subProductId || null, checkType || null, result || 'OK', parameter || null,
        specMin || null, specMax || null, measured || null, notes || null, operatorId]
    );

    const counters = updateQualityCounters(stage.quality_ok, stage.quality_nok, result || 'OK');

    await conn.query(
      `UPDATE productionStages
         SET quality_ok = ?, quality_nok = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE stageId = ?`,
      [counters.ok, counters.nok, stageId]
    );

    await conn.query(
      `INSERT INTO productionStageLogs (stageId, eventType, operatorId, notes)
       VALUES (?, 'quality_check', ?, ?)` ,
      [stageId, operatorId, notes || null]
    );

    await conn.commit();

    const [rows] = await pool.query('SELECT * FROM qualityChecks WHERE checkId = ?', [resultInsert.insertId]);
    logger.info('Quality check stored', { checkId: resultInsert.insertId });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.listQualityChecks = async (req, res, next) => {
  const { result, stageId, subProductId } = req.query;
  const { page, limit } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  try {
    const filters = [];
    const params = [];

    if (result) {
      filters.push('qc.result = ?');
      params.push(result);
    }
    if (stageId) {
      filters.push('qc.stageId = ?');
      params.push(stageId);
    }
    if (subProductId) {
      filters.push('qc.subProductId = ?');
      params.push(subProductId);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM qualityChecks qc ${whereClause}`,
      params
    );

    const [rows] = await pool.query(
      `SELECT qc.*, ps.stageName, sp.componentName
         FROM qualityChecks qc
         LEFT JOIN productionStages ps ON ps.stageId = qc.stageId
         LEFT JOIN subProducts sp ON sp.subProductId = qc.subProductId
         ${whereClause}
         ORDER BY qc.checkedAt DESC
         LIMIT ? OFFSET ?`,
      [...params, safeLimit, offset]
    );

    res.json(buildPaginatedResponse(rows, total, safePage, safeLimit));
  } catch (error) {
    next(error);
  }
};

exports.getStageQualityChecks = async (req, res, next) => {
  const { stageId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT qc.*, sp.componentName
         FROM qualityChecks qc
         LEFT JOIN subProducts sp ON sp.subProductId = qc.subProductId
         WHERE qc.stageId = ?
         ORDER BY qc.checkedAt DESC`,
      [stageId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.updateQualityCheck = async (req, res, next) => {
  const { checkId } = req.params;
  const { result, notes, measured } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM qualityChecks WHERE checkId = ? FOR UPDATE',
      [checkId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Záznam kontroly nenalezen' });
    }

    const updates = [];
    const params = [];

    if (typeof result !== 'undefined') {
      updates.push('result = ?');
      params.push(result);
    }
    if (typeof notes !== 'undefined') {
      updates.push('notes = ?');
      params.push(notes || null);
    }
    if (typeof measured !== 'undefined') {
      updates.push('measured = ?');
      params.push(measured || null);
    }

    if (updates.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Nejsou uvedena žádná data pro aktualizaci' });
    }

    params.push(checkId);

    await conn.query(
      `UPDATE qualityChecks SET ${updates.join(', ')}, checkedAt = CURRENT_TIMESTAMP WHERE checkId = ?`,
      params
    );

    await conn.commit();

    const [updated] = await pool.query('SELECT * FROM qualityChecks WHERE checkId = ?', [checkId]);
    logger.info('Quality check updated', { checkId });

    res.json({ success: true, data: updated[0] });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.getQualityReport = async (_req, res, next) => {
  try {
    const [summary] = await pool.query(
      `SELECT ps.stageName, qc.result, COUNT(*) AS count
         FROM qualityChecks qc
         LEFT JOIN productionStages ps ON ps.stageId = qc.stageId
         GROUP BY ps.stageName, qc.result
         ORDER BY ps.stageName`
    );

    const [byProduct] = await pool.query(
      `SELECT p.productCode, qc.result, COUNT(*) AS count
         FROM qualityChecks qc
         JOIN productionStages ps ON ps.stageId = qc.stageId
         JOIN production p ON p.workOrderId = ps.workOrderId
         GROUP BY p.productCode, qc.result`
    );

    res.json({ success: true, data: { summary, byProduct } });
  } catch (error) {
    next(error);
  }
};
