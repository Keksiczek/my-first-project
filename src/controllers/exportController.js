const pool = require('../config/db');
const logger = require('../config/logger');

function toCsv (rows) {
  if (!rows || rows.length === 0) {
    return '';
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(';')];
  for (const row of rows) {
    lines.push(headers.map((h) => (row[h] ?? '')).join(';'));
  }
  return lines.join('\n');
}

exports.exportInventory = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT w.name AS warehouse, i.barcode, oi.itemName, i.position, i.qtyAvailable, i.dateUpdated
         FROM Inventory i
         LEFT JOIN warehouses w ON w.warehouseId = i.warehouseId
         LEFT JOIN OrderItems oi ON oi.barcode = i.barcode
         ORDER BY w.name, i.position`
    );

    const csv = toCsv(rows);
    logger.info('Inventory export generated', { rows: rows.length });
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('inventory-export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

exports.exportProductionReport = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.workOrderId, p.productCode, p.batchNumber, p.status,
              p.quantityIn, p.quantityOut, p.quantityScrap,
              p.startTime, p.endTime,
              COUNT(ps.stageId) AS stages,
              SUM(ps.outputQuantity) AS stageOutput
         FROM production p
         LEFT JOIN productionStages ps ON ps.workOrderId = p.workOrderId
         GROUP BY p.workOrderId`
    );

    const csv = toCsv(rows);
    logger.info('Production report exported', { rows: rows.length });
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('production-report.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

exports.exportTraceability = async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT oi.barcode, oi.itemName, p.productCode, p.batchNumber,
              m.movementType, m.fromWarehouse, m.toWarehouse, m.quantity, m.dateCreated
         FROM production p
         LEFT JOIN OrderItems oi ON oi.orderId = p.orderId
         LEFT JOIN Movements m ON m.barcode = oi.barcode
         ORDER BY oi.barcode, m.dateCreated`
    );

    const csv = toCsv(rows);
    logger.info('Traceability export generated', { rows: rows.length });
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('traceability.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

exports.customExport = async (req, res, next) => {
  const { resource, filters } = req.body || {};

  try {
    let query = '';
    const params = [];

    switch (resource) {
      case 'production':
        query = 'SELECT workOrderId, productCode, status, startTime, endTime FROM production';
        if (filters?.status) {
          query += ' WHERE status = ?';
          params.push(filters.status);
        }
        break;
      case 'subProducts':
        query = 'SELECT subProductId, componentCode, status, quantity, warehouseId FROM subProducts';
        if (filters?.status) {
          query += ' WHERE status = ?';
          params.push(filters.status);
        }
        break;
      case 'quality':
        query = 'SELECT checkId, stageId, result, checkedAt FROM qualityChecks';
        if (filters?.result) {
          query += ' WHERE result = ?';
          params.push(filters.result);
        }
        break;
      default:
        return res.status(400).json({ success: false, message: 'Neznámý resource pro export' });
    }

    const [rows] = await pool.query(query, params);
    const csv = toCsv(rows);
    logger.info('Custom export generated', { resource, rows: rows.length });

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`${resource || 'custom'}-export.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
};
