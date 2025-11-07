const pool = require('../config/db');

function generateOrderQR(sapNumber) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `ORD-${sapNumber}-${yy}${mm}${dd}`;
}

function generateItemBarcode(index) {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const idx = String(index + 1).padStart(3, '0');
  return `MAT-${yy}${mm}${dd}-${idx}`;
}

async function recalcOrderStatus(conn, orderId) {
  const [rows] = await conn.query(
    `SELECT quantity, qtyReceived FROM OrderItems WHERE orderId = ?`,
    [orderId]
  );

  if (rows.length === 0) return;

  let allZero = true;
  let allComplete = true;

  for (const r of rows) {
    if (r.qtyReceived > 0) allZero = false;
    if (r.qtyReceived < r.quantity) allComplete = false;
  }

  let status = 'Objednáno';
  if (!allZero && !allComplete) status = 'Částečně přijato';
  if (allComplete) status = 'Kompletně přijato';

  await conn.query(
    `UPDATE Orders SET status = ? WHERE orderId = ?`,
    [status, orderId]
  );
}

exports.createOrder = async (req, res, next) => {
  const { sapNumber, supplier, items, notes } = req.body;

  if (!sapNumber || !supplier || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'sapNumber, supplier a items jsou povinné'
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const orderQR = generateOrderQR(sapNumber);

    const [orderResult] = await conn.query(
      `INSERT INTO Orders (sapNumber, orderQR, supplier, notes)
       VALUES (?, ?, ?, ?)`,
      [sapNumber, orderQR, supplier, notes || null]
    );

    const orderId = orderResult.insertId;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const barcode = generateItemBarcode(i);

      await conn.query(
        `INSERT INTO OrderItems
         (orderId, barcode, itemName, quantity, dimension, material, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          barcode,
          it.itemName,
          it.quantity,
          it.dimension || null,
          it.material || null,
          it.position || null
        ]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      orderId,
      orderQR,
      message: 'Objednávka vytvořena'
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
};

exports.getOrders = async (req, res, next) => {
  const { status, supplier } = req.query;

  let sql = `
    SELECT
      o.orderId,
      o.sapNumber,
      o.orderQR,
      o.supplier,
      o.dateCreated,
      o.status,
      COUNT(oi.itemId) AS itemsCount,
      SUM(CASE WHEN oi.qtyReceived > 0 THEN 1 ELSE 0 END) AS itemsReceived
    FROM Orders o
    LEFT JOIN OrderItems oi ON oi.orderId = o.orderId
    WHERE 1 = 1
  `;
  const params = [];

  if (status) {
    sql += ` AND o.status = ?`;
    params.push(status);
  }
  if (supplier) {
    sql += ` AND o.supplier = ?`;
    params.push(supplier);
  }

  sql += ` GROUP BY o.orderId ORDER BY o.dateCreated DESC`;

  try {
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, orders: rows });
  } catch (err) {
    next(err);
  }
};

exports.getOrderById = async (req, res, next) => {
  const orderId = req.params.orderId;

  try {
    const [orders] = await pool.query(
      `SELECT * FROM Orders WHERE orderId = ?`,
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Objednávka nenalezena'
      });
    }

    const order = orders[0];

    const [items] = await pool.query(
      `SELECT itemId, barcode, itemName, quantity, dimension, material, position,
              qtyReceived, status, dateReceived
       FROM OrderItems WHERE orderId = ?`,
      [orderId]
    );

    res.json({
      success: true,
      order,
      items
    });
  } catch (err) {
    next(err);
  }
};

exports.getOrderByQR = async (req, res, next) => {
  const orderQR = req.params.orderQR;

  try {
    const [orders] = await pool.query(
      `SELECT * FROM Orders WHERE orderQR = ?`,
      [orderQR]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Objednávka nenalezena'
      });
    }

    const order = orders[0];

    const [items] = await pool.query(
      `SELECT itemId, barcode, itemName, quantity, dimension, material, position,
              qtyReceived, status, dateReceived
       FROM OrderItems WHERE orderId = ?`,
      [order.orderId]
    );

    res.json({
      success: true,
      order,
      items
    });
  } catch (err) {
    next(err);
  }
};

exports.generateBarcodes = async (req, res, next) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'orderId je povinné'
    });
  }

  try {
    const [items] = await pool.query(
      `SELECT barcode, itemName, quantity FROM OrderItems WHERE orderId = ?`,
      [orderId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Položky pro danou objednávku nenalezeny'
      });
    }

    res.json({
      success: true,
      barcodes: items
    });
  } catch (err) {
    next(err);
  }
};

exports.recalcOrderStatus = recalcOrderStatus;
