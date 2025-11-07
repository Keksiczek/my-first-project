const pool = require('../config/db');
const { MOVEMENT_TYPE } = require('../constants/statuses');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');

exports.moveMaterial = async (req, res, next) => {
  const { barcode, warehouseId, position, quantity, notes } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [itemRows] = await conn.query(
      'SELECT itemId FROM OrderItems WHERE barcode = ?',
      [barcode]
    );

    if (itemRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Položka s daným čárovým kódem neexistuje'
      });
    }

    const [rows] = await conn.query(
      `SELECT * FROM Inventory
       WHERE barcode = ? AND warehouseId = ? AND position = ?
       FOR UPDATE`,
      [barcode, warehouseId, position]
    );

    let inventoryRecord;

    if (rows.length > 0) {
      const current = rows[0];
      const newQty = current.qtyAvailable + quantity;

      await conn.query(
        `UPDATE Inventory
         SET qtyAvailable = ?, dateUpdated = NOW()
         WHERE inventoryId = ?`,
        [newQty, current.inventoryId]
      );

      inventoryRecord = { ...current, qtyAvailable: newQty };
    } else {
      const [result] = await conn.query(
        `INSERT INTO Inventory
         (barcode, warehouseId, position, qtyAvailable)
         VALUES (?, ?, ?, ?)`,
        [barcode, warehouseId, position, quantity]
      );

      inventoryRecord = {
        inventoryId: result.insertId,
        barcode,
        warehouseId,
        position,
        qtyAvailable: quantity
      };
    }

    await conn.query(
      `INSERT INTO Movements
       (barcode, movementType, toWarehouse, toPosition, quantity, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [barcode, MOVEMENT_TYPE.MOVE, warehouseId, position, quantity, notes || null]
    );

    await conn.query('DELETE FROM Inventory WHERE qtyAvailable = 0');

    await conn.commit();

    res.json({
      success: true,
      message: 'Materiál přesunut',
      inventory: {
        barcode: inventoryRecord.barcode,
        warehouseId: inventoryRecord.warehouseId,
        position: inventoryRecord.position,
        qtyAvailable: inventoryRecord.qtyAvailable
      }
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.consumeMaterial = async (req, res, next) => {
  const { barcode, warehouseId, position, quantity, notes } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [inventoryRows] = await conn.query(
      `SELECT * FROM Inventory
       WHERE barcode = ? AND warehouseId = ? AND position = ?
       FOR UPDATE`,
      [barcode, warehouseId, position]
    );

    if (inventoryRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Záznam ve skladu pro dané umístění nenalezen'
      });
    }

    const current = inventoryRows[0];

    if (current.qtyAvailable < quantity) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'Nedostatečné množství na skladě'
      });
    }

    const newQty = current.qtyAvailable - quantity;

    await conn.query(
      `UPDATE Inventory
       SET qtyAvailable = ?, dateUpdated = NOW()
       WHERE inventoryId = ?`,
      [newQty, current.inventoryId]
    );

    await conn.query(
      `INSERT INTO Movements
       (barcode, movementType, fromWarehouse, fromPosition, quantity, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [barcode, MOVEMENT_TYPE.CONSUME, warehouseId, position, quantity, notes || null]
    );

    await conn.query('DELETE FROM Inventory WHERE qtyAvailable = 0');

    await conn.commit();

    res.json({
      success: true,
      message: 'Materiál vyskladněn',
      inventory: {
        barcode: current.barcode,
        warehouseId: current.warehouseId,
        position: current.position,
        qtyAvailable: newQty
      }
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.getMovementsByBarcode = async (req, res, next) => {
  const { barcode } = req.params;
  const { page, limit } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  try {
    const countSql = 'SELECT COUNT(*) AS total FROM Movements WHERE barcode = ?';
    const [countRows] = await pool.query(countSql, [barcode]);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT movementId, barcode, movementType,
             fromWarehouse, fromPosition,
             toWarehouse, toPosition,
             quantity, notes, dateCreated
      FROM Movements
      WHERE barcode = ?
      ORDER BY dateCreated DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataSql, [barcode, safeLimit, offset]);

    const response = buildPaginatedResponse(rows, total, safePage, safeLimit);
    response.movements = rows;

    res.json(response);
  } catch (error) {
    next(error);
  }
};
