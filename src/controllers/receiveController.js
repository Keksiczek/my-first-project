const pool = require('../config/db');
const { recalcOrderStatus } = require('./orderController');

exports.receiveFull = async (req, res, next) => {
  const { barcode, quantityReceived, notes } = req.body;

  if (!barcode || quantityReceived == null) {
    return res.status(400).json({
      success: false,
      message: 'barcode a quantityReceived jsou povinné'
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM OrderItems WHERE barcode = ?`,
      [barcode]
    );

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Položka nenalezena'
      });
    }

    const item = rows[0];
    const newQty = quantityReceived;

    const status =
      newQty >= item.quantity ? 'complete' : newQty > 0 ? 'partial' : 'pending';

    await conn.query(
      `UPDATE OrderItems
       SET qtyReceived = ?, status = ?, dateReceived = NOW()
       WHERE itemId = ?`,
      [newQty, status, item.itemId]
    );

    await conn.query(
      `INSERT INTO Movements
       (barcode, movementType, quantity, notes)
       VALUES (?, 'receive', ?, ?)`,
      [barcode, quantityReceived, notes || null]
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
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

exports.receivePartial = async (req, res, next) => {
  const { barcode, quantityReceived, notes } = req.body;

  if (!barcode || quantityReceived == null) {
    return res.status(400).json({
      success: false,
      message: 'barcode a quantityReceived jsou povinné'
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM OrderItems WHERE barcode = ?`,
      [barcode]
    );

    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        message: 'Položka nenalezena'
      });
    }

    const item = rows[0];
    const newQty = item.qtyReceived + quantityReceived;
    const qtyRemaining = item.quantity - newQty;

    const status =
      newQty >= item.quantity ? 'complete' : newQty > 0 ? 'partial' : 'pending';

    await conn.query(
      `UPDATE OrderItems
       SET qtyReceived = ?, status = ?, dateReceived = NOW()
       WHERE itemId = ?`,
      [newQty, status, item.itemId]
    );

    await conn.query(
      `INSERT INTO Movements
       (barcode, movementType, quantity, notes)
       VALUES (?, 'receive', ?, ?)`,
      [barcode, quantityReceived, notes || null]
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
        qtyRemaining: qtyRemaining > 0 ? qtyRemaining : 0,
        status
      }
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};
