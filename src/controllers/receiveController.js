const pool = require('../config/db');
const { recalcOrderStatus } = require('./orderController');
const { ITEM_STATUS, MOVEMENT_TYPE } = require('../constants/statuses');

exports.receiveFull = async (req, res, next) => {
  const { barcode, quantityReceived, notes } = req.body;
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

    await conn.query(
      `INSERT INTO Movements
       (barcode, movementType, quantity, notes)
       VALUES (?, ?, ?, ?)`,
      [barcode, MOVEMENT_TYPE.RECEIVE, quantityReceived, notes || null]
    );

    await recalcOrderStatus(conn, item.orderId);

    await conn.commit();

    res.json({
      success: true,
      message: 'Příjem potvrzen',
      item: {
        barcode: item.barcode,
        itemName: item.itemName,
        qtyReceived: newQty,
        status
      }
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.receivePartial = async (req, res, next) => {
  const { barcode, quantityReceived, notes } = req.body;
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

    await conn.query(
      `INSERT INTO Movements
       (barcode, movementType, quantity, notes)
       VALUES (?, ?, ?, ?)`,
      [barcode, MOVEMENT_TYPE.RECEIVE, quantityReceived, notes || null]
    );

    await recalcOrderStatus(conn, item.orderId);

    await conn.commit();

    res.json({
      success: true,
      message: 'Částečný příjem potvrzen',
      item: {
        barcode: item.barcode,
        itemName: item.itemName,
        qtyReceived: newQty,
        qtyRemaining,
        status
      }
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};
