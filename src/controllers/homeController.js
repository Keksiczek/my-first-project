// ZMĚNA: Nový controller pro dashboard homepage
const pool = require('../config/db');

exports.getDashboard = async (req, res, next) => {
  try {
    const [orderTypeStats] = await pool.query(
      'SELECT orderType, COUNT(*) AS count FROM Orders GROUP BY orderType'
    );

    const [assemblyStats] = await pool.query(
      'SELECT assemblyStatus, COUNT(*) AS count FROM Orders WHERE orderType = \'zakazka\' GROUP BY assemblyStatus'
    );

    const [warehouseStats] = await pool.query(
      `SELECT COUNT(*) AS totalWarehouses,
              SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) AS activeWarehouses
         FROM warehouses`
    );

    const [inventoryStats] = await pool.query(
      'SELECT COUNT(DISTINCT barcode) AS totalItems, SUM(qtyAvailable) AS totalQuantity FROM Inventory'
    );

    const [recentMovements] = await pool.query(
      `SELECT m.movementType, m.barcode, oi.itemName, m.quantity, m.dateCreated
         FROM Movements m
         LEFT JOIN OrderItems oi ON oi.barcode = m.barcode
         ORDER BY m.dateCreated DESC
         LIMIT 5`
    );

    const [qualityStats] = await pool.query(
      `SELECT result, COUNT(*) AS count
         FROM qualityChecks
         WHERE checkedAt >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY result`
    );

    const [productionStats] = await pool.query(
      `SELECT status, COUNT(*) AS count
         FROM production
         GROUP BY status`
    );

    const [activeOrders] = await pool.query(
      `SELECT orderId, sapNumber, supplier, orderType, assemblyStatus, dateStarted, operator
         FROM Orders
         WHERE assemblyStatus = 'in_progress'
         ORDER BY dateStarted DESC
         LIMIT 10`
    );

    res.json({
      success: true,
      dashboard: {
        orders: {
          byType: orderTypeStats,
          byAssemblyStatus: assemblyStats,
          active: activeOrders
        },
        warehouses: warehouseStats[0] || { totalWarehouses: 0, activeWarehouses: 0 },
        inventory: inventoryStats[0] || { totalItems: 0, totalQuantity: 0 },
        recentMovements,
        quality: qualityStats,
        production: productionStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};
