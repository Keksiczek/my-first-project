const pool = require('../config/db');
const { ITEM_STATUS, ORDER_STATUS } = require('../constants/statuses');
const { generateOrderQR, generateItemBarcode, calculateOrderStatus } = require('../utils/helpers');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');

async function generateUniqueBarcode (conn, index) {
  let attempt = 0;
  let barcode;
  let exists = true;

  while (exists && attempt < 1000) {
    barcode = generateItemBarcode(index + attempt);
    const [rows] = await conn.query(
      'SELECT itemId FROM OrderItems WHERE barcode = ?',
      [barcode]
    );
    exists = rows.length > 0;
    if (exists) {
      attempt += 1;
    }
  }

  if (exists) {
    throw new Error('Nepodařilo se vygenerovat unikátní čárový kód');
  }

  return barcode;
}

async function recalcOrderStatus (conn, orderId) {
  const [rows] = await conn.query(
    'SELECT qtyReceived, status FROM OrderItems WHERE orderId = ?',
    [orderId]
  );

  if (rows.length === 0) {
    return;
  }

  const newStatus = calculateOrderStatus(rows);
  const statusMap = {
    pending: ORDER_STATUS.PENDING,
    partial: ORDER_STATUS.PARTIAL,
    complete: ORDER_STATUS.COMPLETE
  };

  await conn.query(
    'UPDATE Orders SET status = ? WHERE orderId = ?',
    [statusMap[newStatus] || ORDER_STATUS.PENDING, orderId]
  );
}

exports.createOrder = async (req, res, next) => {
  const { sapNumber, supplier, items, notes } = req.body;
  if (!sapNumber || !supplier || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Chybí povinná data objednávky'
    });
  }
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const orderQR = generateOrderQR(sapNumber);
    const [orderResult] = await conn.query(
      `INSERT INTO Orders (sapNumber, orderQR, supplier, notes)
       VALUES (?, ?, ?, ?)` ,
      [sapNumber, orderQR, supplier, notes || null]
    );

    const orderId = orderResult.insertId;

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const barcode = await generateUniqueBarcode(conn, i);

      await conn.query(
        `INSERT INTO OrderItems
         (orderId, barcode, itemName, quantity, dimension, material, position, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
        [
          orderId,
          barcode,
          item.itemName,
          item.quantity,
          item.dimension || null,
          item.material || null,
          item.position || null,
          ITEM_STATUS.PENDING
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
  } catch (error) {
    await conn.rollback();
    error.statusCode = error.statusCode || 500;
    next(error);
  } finally {
    conn.release();
  }
};

exports.getOrders = async (req, res, next) => {
  const { status, supplier, page, limit } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  let whereClause = 'WHERE 1 = 1';
  const params = [];

  if (status) {
    whereClause += ' AND o.status = ?';
    params.push(status);
  }

  if (supplier) {
    whereClause += ' AND o.supplier LIKE ?';
    params.push(`%${supplier}%`);
  }

  try {
    const countSql = `
      SELECT COUNT(DISTINCT o.orderId) AS total
      FROM Orders o
      ${whereClause}
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT
        o.orderId,
        o.sapNumber,
        o.orderQR,
        o.supplier,
        o.dateCreated,
        o.status,
        o.notes,
        COUNT(oi.itemId) AS itemsCount,
        SUM(CASE WHEN oi.qtyReceived > 0 THEN 1 ELSE 0 END) AS itemsReceived,
        SUM(CASE WHEN oi.status = ? THEN 1 ELSE 0 END) AS itemsCompleted
      FROM Orders o
      LEFT JOIN OrderItems oi ON oi.orderId = o.orderId
      ${whereClause}
      GROUP BY o.orderId
      ORDER BY o.dateCreated DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(dataSql, [...params, ITEM_STATUS.COMPLETE, safeLimit, offset]);

    const response = buildPaginatedResponse(rows, total, safePage, safeLimit);
    response.orders = rows;

    res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  const { orderId } = req.params;

  try {
    const [orders] = await pool.query(
      'SELECT * FROM Orders WHERE orderId = ?',
      [orderId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Objednávka nenalezena'
      });
    }

    const [items] = await pool.query(
      `SELECT itemId, barcode, itemName, quantity, dimension, material, position,
              qtyReceived, status, dateReceived
       FROM OrderItems WHERE orderId = ?`,
      [orderId]
    );

    return res.json({
      success: true,
      order: orders[0],
      items
    });
  } catch (error) {
    return next(error);
  }
};

exports.getOrderByQR = async (req, res, next) => {
  const { orderQR } = req.params;

  try {
    const [orders] = await pool.query(
      'SELECT * FROM Orders WHERE orderQR = ?',
      [orderQR]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Objednávka nenalezena'
      });
    }

    const [items] = await pool.query(
      `SELECT itemId, barcode, itemName, quantity, dimension, material, position,
              qtyReceived, status, dateReceived
       FROM OrderItems WHERE orderId = ?`,
      [orders[0].orderId]
    );

    return res.json({
      success: true,
      order: orders[0],
      items
    });
  } catch (error) {
    return next(error);
  }
};

exports.generateBarcodes = async (req, res, next) => {
  const { orderId } = req.body;

  try {
    const [items] = await pool.query(
      'SELECT barcode, itemName, quantity FROM OrderItems WHERE orderId = ?',
      [orderId]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Položky pro danou objednávku nenalezeny'
      });
    }

    return res.json({
      success: true,
      barcodes: items
    });
  } catch (error) {
    return next(error);
  }
};

exports.recalcOrderStatus = recalcOrderStatus;
