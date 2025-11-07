// ZMĚNA: Controller pro kontrolu kvality s auditním logováním
const pool = require('../config/db');
const { QUALITY_RESULT, ASSEMBLY_STATUS, REPORT_TYPE } = require('../constants/statuses');
const logger = require('../config/logger');

exports.performQualityCheck = async (req, res, next) => {
  const { orderId } = req.params;
  const { result, inspector, notes, parameters } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      'SELECT orderId, assemblyStatus FROM Orders WHERE orderId = ?',
      [orderId]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Zakázka nenalezena' });
    }

    const preparedParams = parameters ? JSON.stringify(parameters) : null;

    await conn.query(
      `INSERT INTO QualityChecks (orderId, result, inspector, notes, parameters)
       VALUES (?, ?, ?, ?, ?)` ,
      [orderId, result, inspector, notes || null, preparedParams]
    );

    const newStatus = result === QUALITY_RESULT.OK ? ASSEMBLY_STATUS.APPROVED : ASSEMBLY_STATUS.REJECTED;

    await conn.query(
      'UPDATE Orders SET assemblyStatus = ? WHERE orderId = ?',
      [newStatus, orderId]
    );

    await conn.query(
      `INSERT INTO AssemblyReports (orderId, reportType, operator, previousStatus, newStatus, notes)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [
        orderId,
        REPORT_TYPE.QUALITY,
        inspector || null,
        orderRows[0].assemblyStatus,
        newStatus,
        notes || null
      ]
    );

    await conn.query(
      `INSERT INTO AuditLog (tableName, recordId, action, userId, oldValue, newValue)
       VALUES ('Orders', ?, 'STATUS_CHANGE', ?, ?, ?)` ,
      [
        orderId,
        inspector || null,
        JSON.stringify({ assemblyStatus: orderRows[0].assemblyStatus }),
        JSON.stringify({ assemblyStatus: newStatus, qualityResult: result })
      ]
    );

    await conn.commit();

    logger.info('Quality check recorded', {
      orderId: Number(orderId),
      result,
      inspector,
      assemblyStatus: newStatus
    });

    res.json({ success: true, message: 'Kontrola kvality uložena', result: newStatus });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.getQualityHistory = async (req, res, next) => {
  const { orderId } = req.params;

  try {
    const [orderRows] = await pool.query(
      'SELECT orderId FROM Orders WHERE orderId = ?',
      [orderId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Zakázka nenalezena' });
    }

    const [rows] = await pool.query(
      `SELECT * FROM QualityChecks WHERE orderId = ? ORDER BY dateChecked DESC`,
      [orderId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
