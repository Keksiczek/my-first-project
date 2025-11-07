const pool = require('../config/db');

exports.getInventory = async (req, res, next) => {
  const { warehouse, barcode, search } = req.query;

  let sql = `
    SELECT
      i.barcode,
      oi.itemName,
      i.warehouseId,
      i.position,
      i.qtyAvailable,
      i.dateAdded
    FROM Inventory i
    LEFT JOIN OrderItems oi ON oi.barcode = i.barcode
    WHERE 1 = 1
  `;
  const params = [];

  if (warehouse) {
    sql += ` AND i.warehouseId = ?`;
    params.push(warehouse);
  }
  if (barcode) {
    sql += ` AND i.barcode = ?`;
    params.push(barcode);
  }
  if (search) {
    sql += ` AND (oi.itemName LIKE ? OR oi.dimension LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  try {
    const [rows] = await pool.query(sql, params);
    res.json({
      success: true,
      inventory: rows
    });
  } catch (err) {
    next(err);
  }
};
