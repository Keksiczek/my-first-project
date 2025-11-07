const pool = require('../config/db');

exports.moveMaterial = async (req, res, next) => {
  const { barcode, warehouseId, position, quantity, notes } = req.body;

  if (!barcode || !warehouseId || !position || !quantity) {
    return res.status(400).json({
      success: false,
      message: 'barcode, warehouseId, position a quantity jsou povinné'
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [itemRows] = await conn.query(
      `SELECT itemId FROM OrderItems WHERE barcode = ?`,
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
       VALUES (?, 'move', ?, ?, ?, ?)`,
      [barcode, warehouseId, position, quantity, notes || null]
    );

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
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

exports.consumeMaterial = async (req, res, next) => {
  const { barcode, warehouseId, position, quantity, notes } = req.body;

  if (!barcode || !warehouseId || !position || !quantity) {
    return res.status(400).json({
      success: false,
      message: 'barcode, warehouseId, position a quantity jsou povinné'
    });
  }

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
       VALUES (?, 'consume', ?, ?, ?, ?)`,
      [barcode, warehouseId, position, quantity, notes || null]
    );

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
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

exports.getMovementsByBarcode = async (req, res, next) => {
  const { barcode } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT movementId, barcode, movementType,
              fromWarehouse, fromPosition,
              toWarehouse, toPosition,
              quantity, notes, dateCreated
       FROM Movements
       WHERE barcode = ?
       ORDER BY dateCreated DESC`,
      [barcode]
    );

    res.json({
      success: true,
      movements: rows
    });
  } catch (err) {
    next(err);
  }
};
