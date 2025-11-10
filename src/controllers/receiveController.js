const pool = require('../config/db');
const { recalcOrderStatus } = require('./orderController');
const { ITEM_STATUS, MOVEMENT_TYPE } = require('../constants/statuses');
const logger = require('../config/logger');

// ZMĚNA: příjem nyní vyžaduje údaje o skladě a automaticky aktualizuje inventář
exports.receiveFull = async (req, res, next) => {
  const { barcode, quantityReceived, notes, warehouseId, position } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM OrderItems WHERE barcode = ? FOR UPDATE',
      [barcode]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Položka nenalezena'
      });
    }

    const item = rows[0];
    const newQty = quantityReceived;
    const status =
      newQty >= item.quantity
        ? ITEM_STATUS.COMPLETE
        : newQty > 0
          ? ITEM_STATUS.PARTIAL
          : ITEM_STATUS.PENDING;

    await conn.query(
      `UPDATE OrderItems
       SET qtyReceived = ?, status = ?, dateReceived = NOW()
       WHERE itemId = ?`,
      [newQty, status, item.itemId]
    );

    const [inventoryRows] = await conn.query(
      `SELECT * FROM Inventory
       WHERE barcode = ? AND warehouseId = ? AND position = ?
       FOR UPDATE`,
      [barcode, warehouseId, position]
    );

    let inventoryRecord;

    if (inventoryRows.length > 0) {
      const currentInventory = inventoryRows[0];
      const updatedQty = currentInventory.qtyAvailable + quantityReceived;

      await conn.query(
        `UPDATE Inventory
         SET qtyAvailable = ?, dateUpdated = NOW()
         WHERE inventoryId = ?`,
        [updatedQty, currentInventory.inventoryId]
      );

      inventoryRecord = { ...currentInventory, qtyAvailable: updatedQty };
    } else {
      const [insertResult] = await conn.query(
        `INSERT INTO Inventory
         (barcode, warehouseId, position, qtyAvailable)
         VALUES (?, ?, ?, ?)`,
        [barcode, warehouseId, position, quantityReceived]
      );

      inventoryRecord = {
        inventoryId: insertResult.insertId,
        barcode,
        warehouseId,
        position,
        qtyAvailable: quantityReceived
      };
    }

    await conn.query(
      `INSERT INTO Movements
       (barcode, movementType, toWarehouse, toPosition, quantity, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        barcode,
        MOVEMENT_TYPE.RECEIVE,
        warehouseId,
        position,
        quantityReceived,
        notes || null
      ]
    );

    await recalcOrderStatus(conn, item.orderId);

    await conn.commit();

    logger.info('Material received', {
      barcode,
      quantity: quantityReceived,
      warehouseId,
      position
    });

    res.json({
      success: true,
      message: 'Příjem potvrzen',
      item: {
        barcode: item.barcode,
        itemName: item.itemName,
        qtyReceived: newQty,
        status
      },
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

// ZMĚNA: částečný příjem rovněž aktualizuje inventář
exports.receivePartial = async (req, res, next) => {
  const { barcode, quantityReceived, notes, warehouseId, position } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM OrderItems WHERE barcode = ? FOR UPDATE',
      [barcode]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Položka nenalezena'
      });
    }

    const item = rows[0];
    const newQty = item.qtyReceived + quantityReceived;
    const qtyRemaining = Math.max(item.quantity - newQty, 0);
    const status =
      newQty >= item.quantity
        ? ITEM_STATUS.COMPLETE
        : newQty > 0
          ? ITEM_STATUS.PARTIAL
          : ITEM_STATUS.PENDING;

    await conn.query(
      `UPDATE OrderItems
       SET qtyReceived = ?, status = ?, dateReceived = NOW()
       WHERE itemId = ?`,
      [newQty, status, item.itemId]
    );

    const [inventoryRows] = await conn.query(
      `SELECT * FROM Inventory
       WHERE barcode = ? AND warehouseId = ? AND position = ?
       FOR UPDATE`,
      [barcode, warehouseId, position]
    );

    let inventoryRecord;

    if (inventoryRows.length > 0) {
      const currentInventory = inventoryRows[0];
      const updatedQty = currentInventory.qtyAvailable + quantityReceived;

      await conn.query(
        `UPDATE Inventory
         SET qtyAvailable = ?, dateUpdated = NOW()
         WHERE inventoryId = ?`,
        [updatedQty, currentInventory.inventoryId]
      );

      inventoryRecord = { ...currentInventory, qtyAvailable: updatedQty };
    } else {
      const [insertResult] = await conn.query(
        `INSERT INTO Inventory
         (barcode, warehouseId, position, qtyAvailable)
         VALUES (?, ?, ?, ?)`,
        [barcode, warehouseId, position, quantityReceived]
      );

      inventoryRecord = {
        inventoryId: insertResult.insertId,
        barcode,
        warehouseId,
        position,
        qtyAvailable: quantityReceived
      };
    }

    await conn.query(
      `INSERT INTO Movements
       (barcode, movementType, toWarehouse, toPosition, quantity, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        barcode,
        MOVEMENT_TYPE.RECEIVE,
        warehouseId,
        position,
        quantityReceived,
        notes || null
      ]
    );

    await recalcOrderStatus(conn, item.orderId);

    await conn.commit();

    logger.info('Material partially received', {
      barcode,
      quantity: quantityReceived,
      warehouseId,
      position
    });

    res.json({
      success: true,
      message: 'Částečný příjem potvrzen',
      item: {
        barcode: item.barcode,
        itemName: item.itemName,
        qtyReceived: newQty,
        qtyRemaining,
        status
      },
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
