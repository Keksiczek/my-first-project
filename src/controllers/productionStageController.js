const pool = require('../config/db');
const logger = require('../config/logger');
const { resolveStageStatus } = require('../services/productionService');

async function getStageById (stageId, conn = pool) {
  const runner = conn.query ? conn : pool;
  const [rows] = await runner.query('SELECT * FROM productionStages WHERE stageId = ?', [stageId]);
  return rows[0];
}

async function addStageLog (conn, stageId, eventType, operatorId, quantity, duration, notes) {
  await conn.query(
    `INSERT INTO productionStageLogs (stageId, eventType, operatorId, quantity, duration, notes)
     VALUES (?, ?, ?, ?, ?, ?)` ,
    [stageId, eventType, operatorId || null, quantity || null, duration || null, notes || null]
  );
}

async function updateProductionStatusIfNeeded (conn, workOrderId) {
  const [[{ totalStages, completedStages }]] = await conn.query(
    `SELECT COUNT(*) AS totalStages,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedStages
       FROM productionStages
       WHERE workOrderId = ?`,
    [workOrderId]
  );

  if (totalStages > 0 && totalStages === completedStages) {
    await conn.query(
      `UPDATE production
         SET status = 'completed', endTime = COALESCE(endTime, NOW()), updatedAt = CURRENT_TIMESTAMP
       WHERE workOrderId = ?`,
      [workOrderId]
    );
  } else {
    await conn.query(
      `UPDATE production
         SET status = 'in_progress', updatedAt = CURRENT_TIMESTAMP
       WHERE workOrderId = ? AND status = 'started'`,
      [workOrderId]
    );
  }
}

exports.startStage = async (req, res, next) => {
  const { stageId } = req.params;
  const { operatorId, quantity } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const stage = await getStageById(stageId, conn);
    if (!stage) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Mezioperace nenalezena' });
    }

    const nextStatus = resolveStageStatus(stage.status, 'start');

    await conn.query(
      `UPDATE productionStages
         SET status = ?, startTime = COALESCE(startTime, NOW()), operatorId = COALESCE(?, operatorId)
       WHERE stageId = ?`,
      [nextStatus, operatorId || req.user?.userId || null, stageId]
    );

    await addStageLog(conn, stageId, 'started', operatorId || req.user?.userId, quantity, null, null);
    await updateProductionStatusIfNeeded(conn, stage.workOrderId);

    await conn.commit();

    const updatedStage = await getStageById(stageId);
    logger.info('Production stage started', { stageId });

    res.json({ success: true, data: updatedStage });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.pauseStage = async (req, res, next) => {
  await handleStageAction(req, res, next, 'pause');
};

exports.resumeStage = async (req, res, next) => {
  await handleStageAction(req, res, next, 'resume');
};

exports.completeStage = async (req, res, next) => {
  await handleStageAction(req, res, next, 'complete');
};

async function handleStageAction (req, res, next, action) {
  const { stageId } = req.params;
  const { operatorId, quantity, scrapQuantity, reworkQuantity, notes, duration } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const stage = await getStageById(stageId, conn);
    if (!stage) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Mezioperace nenalezena' });
    }

    const nextStatus = resolveStageStatus(stage.status, action);

    const updates = ['status = ?'];
    const params = [nextStatus];

    if (action === 'resume') {
      updates.push('startTime = COALESCE(startTime, NOW())');
    }
    if (action === 'complete') {
      updates.push('endTime = NOW()');
      updates.push('outputQuantity = COALESCE(?, outputQuantity)');
      updates.push('scrapQuantity = COALESCE(?, scrapQuantity)');
      updates.push('reworkQuantity = COALESCE(?, reworkQuantity)');
      params.push(quantity || stage.outputQuantity || 0);
      params.push(scrapQuantity || stage.scrapQuantity || 0);
      params.push(reworkQuantity || stage.reworkQuantity || 0);
    }

    params.push(stageId);

    await conn.query(
      `UPDATE productionStages SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE stageId = ?`,
      params
    );

    await addStageLog(conn, stageId, action === 'complete' ? 'completed' : action, operatorId || req.user?.userId, quantity, duration, notes);

    if (action === 'complete') {
      await updateProductionStatusIfNeeded(conn, stage.workOrderId);
    }

    await conn.commit();

    const updatedStage = await getStageById(stageId);
    logger.info('Production stage action', { stageId, action });

    res.json({ success: true, data: updatedStage });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
}

exports.getStageDetail = async (req, res, next) => {
  const { stageId } = req.params;

  try {
    const stage = await getStageById(stageId);
    if (!stage) {
      return res.status(404).json({ success: false, message: 'Mezioperace nenalezena' });
    }

    const [logs] = await pool.query(
      'SELECT * FROM productionStageLogs WHERE stageId = ? ORDER BY timestamp',
      [stageId]
    );

    const [quality] = await pool.query(
      'SELECT * FROM qualityChecks WHERE stageId = ? ORDER BY checkedAt DESC',
      [stageId]
    );

    res.json({ success: true, data: { stage, logs, quality } });
  } catch (error) {
    next(error);
  }
};

exports.getStageLogs = async (req, res, next) => {
  const { stageId } = req.params;

  try {
    const [logs] = await pool.query(
      'SELECT * FROM productionStageLogs WHERE stageId = ? ORDER BY timestamp DESC',
      [stageId]
    );

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
};
