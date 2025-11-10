const pool = require('../config/db');
const { getPaginationParams, buildPaginatedResponse } = require('../utils/pagination');

exports.getInventory = async (req, res, next) => {
  const { warehouse, barcode, search, page, limit } = req.query;
  const { limit: safeLimit, offset, page: safePage } = getPaginationParams(page, limit);

  let whereClause = 'WHERE 1 = 1';
  const params = [];

  if (warehouse) {
    whereClause += ' AND i.warehouseId = ?';
    params.push(warehouse);
  }
  if (barcode) {
    whereClause += ' AND i.barcode = ?';
    params.push(barcode);
  }
  if (search) {
    whereClause += ' AND (oi.itemName LIKE ? OR oi.dimension LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  try {
    const countSql = `
      SELECT COUNT(*) AS total
      FROM Inventory i
      LEFT JOIN OrderItems oi ON oi.barcode = i.barcode
      ${whereClause}
    `;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0]?.total || 0;

    const dataSql = `
      SELECT
        i.barcode,
        oi.itemName,
        i.warehouseId,
        i.position,
        i.qtyAvailable,
        i.dateAdded,
        i.dateUpdated
      FROM Inventory i
      LEFT JOIN OrderItems oi ON oi.barcode = i.barcode
      ${whereClause}
      ORDER BY i.dateUpdated DESC
      LIMIT ? OFFSET ?
    `;
    const [rows] = await pool.query(dataSql, [...params, safeLimit, offset]);

    const response = buildPaginatedResponse(rows, total, safePage, safeLimit);
    response.inventory = rows;

    res.json(response);
  } catch (error) {
    next(error);
  }
};
