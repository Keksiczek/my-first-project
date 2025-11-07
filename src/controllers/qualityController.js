// ZMĚNA: Nový controller pro kontrolu kvality
const pool = require('../config/db');
const { QUALITY_RESULT, ASSEMBLY_STATUS } = require('../constants/statuses');

exports.performQualityCheck = async (req, res, next) => {
  const { orderId } = req.params;
  const { result, inspector, notes, parameters } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      'SELECT orderId FROM Orders WHERE orderId = ?',
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
      `INSERT INTO AuditLog (tableName, recordId, action, userId, newValue)
       VALUES ('Orders', ?, 'STATUS_CHANGE', ?, ?)` ,
      [orderId, inspector || null, JSON.stringify({ assemblyStatus: newStatus, qualityResult: result })]
    );

    await conn.commit();

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
    const [rows] = await pool.query(
      `SELECT * FROM QualityChecks WHERE orderId = ? ORDER BY dateChecked DESC`,
      [orderId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
