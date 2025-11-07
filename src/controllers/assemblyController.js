// ZMĚNA: Nový controller pro práci se stromovou strukturou zakázek
const pool = require('../config/db');
const {
  ORDER_TYPE,
  ASSEMBLY_STATUS,
  COMPONENT_TYPE,
  REPORT_TYPE
} = require('../constants/statuses');
const { generateOrderQR } = require('../utils/helpers');

async function buildAssemblyTree (orderId, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) {
    throw new Error('Překročena maximální hloubka stromu assembly');
  }

  const [orderRows] = await pool.query(
    'SELECT * FROM Orders WHERE orderId = ?',
    [orderId]
  );

  if (orderRows.length === 0) {
    return null;
  }

  const order = orderRows[0];

  const [components] = await pool.query(
    `SELECT * FROM OrderComponents WHERE orderId = ? ORDER BY sortOrder, componentId`,
    [orderId]
  );

  const children = [];

  for (const component of components) {
    if (component.componentType === COMPONENT_TYPE.ORDER) {
      const childTree = await buildAssemblyTree(component.componentOrderId, depth + 1, maxDepth);
      if (childTree) {
        children.push({
          componentId: component.componentId,
          type: 'assembly',
          quantityRequired: component.quantityRequired,
          quantityUsed: component.quantityUsed,
          assembly: childTree
        });
      }
    } else if (component.componentType === COMPONENT_TYPE.ITEM) {
      const [itemRows] = await pool.query(
        'SELECT * FROM OrderItems WHERE itemId = ?',
        [component.componentItemId]
      );
      if (itemRows.length > 0) {
        children.push({
          componentId: component.componentId,
          type: 'item',
          quantityRequired: component.quantityRequired,
          quantityUsed: component.quantityUsed,
          item: itemRows[0]
        });
      }
    }
  }

  return {
    ...order,
    components: children
  };
}

exports.createAssembly = async (req, res, next) => {
  const { sapNumber, supplier, orderType, parentOrderId, notes, operator } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT orderId FROM Orders WHERE sapNumber = ?',
      [sapNumber]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'Zakázka s tímto SAP číslem již existuje',
        existingOrderId: existing[0].orderId
      });
    }

    const orderQR = generateOrderQR(sapNumber);

    const [insertResult] = await conn.query(
      `INSERT INTO Orders (sapNumber, orderQR, supplier, notes, orderType, parentOrderId, operator)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        sapNumber,
        orderQR,
        supplier,
        notes || null,
        orderType || ORDER_TYPE.ZAKAZKA,
        parentOrderId || null,
        operator || null
      ]
    );

    const newOrderId = insertResult.insertId;

    if (parentOrderId) {
      await conn.query(
        `INSERT INTO OrderComponents (orderId, componentType, componentOrderId, quantityRequired)
         VALUES (?, ?, ?, ?)` ,
        [parentOrderId, COMPONENT_TYPE.ORDER, newOrderId, 1]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Zakázka vytvořena',
      data: { orderId: newOrderId, orderQR }
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.addComponentToAssembly = async (req, res, next) => {
  const { orderId } = req.params;
  const { componentType, componentOrderId, componentItemId, quantityRequired, sortOrder } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      'SELECT orderId FROM Orders WHERE orderId = ?',
      [orderId]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Zakázka nenalezena'
      });
    }

    if (componentType === COMPONENT_TYPE.ORDER) {
      if (!componentOrderId) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Chybí componentOrderId' });
      }
    } else if (componentType === COMPONENT_TYPE.ITEM) {
      if (!componentItemId) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'Chybí componentItemId' });
      }
    } else {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Neznámý typ komponenty' });
    }

    await conn.query(
      `INSERT INTO OrderComponents (orderId, componentType, componentOrderId, componentItemId, quantityRequired, sortOrder)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [
        orderId,
        componentType,
        componentType === COMPONENT_TYPE.ORDER ? componentOrderId : null,
        componentType === COMPONENT_TYPE.ITEM ? componentItemId : null,
        quantityRequired || 1,
        sortOrder || 0
      ]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: 'Komponenta přidána'
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.removeComponentFromAssembly = async (req, res, next) => {
  const { componentId } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM OrderComponents WHERE componentId = ?',
      [componentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Komponenta nenalezena'
      });
    }

    res.json({
      success: true,
      message: 'Komponenta odstraněna'
    });
  } catch (error) {
    next(error);
  }
};

exports.getAssemblyTree = async (req, res, next) => {
  const { orderId } = req.params;

  try {
    const tree = await buildAssemblyTree(parseInt(orderId, 10));

    if (!tree) {
      return res.status(404).json({
        success: false,
        message: 'Zakázka nenalezena'
      });
    }

    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    next(error);
  }
};

exports.startAssembly = async (req, res, next) => {
  const { orderId } = req.params;
  const { operator, notes } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      'SELECT assemblyStatus FROM Orders WHERE orderId = ?',
      [orderId]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Zakázka nenalezena' });
    }

    await conn.query(
      `UPDATE Orders
         SET assemblyStatus = ?, dateStarted = COALESCE(dateStarted, NOW()), operator = COALESCE(?, operator)
       WHERE orderId = ?` ,
      [ASSEMBLY_STATUS.IN_PROGRESS, operator || null, orderId]
    );

    await conn.query(
      `INSERT INTO AssemblyReports (orderId, reportType, operator, previousStatus, newStatus, notes)
       VALUES (?, ?, ?, ?, ?, ?)` ,
      [
        orderId,
        REPORT_TYPE.START,
        operator || null,
        orderRows[0].assemblyStatus,
        ASSEMBLY_STATUS.IN_PROGRESS,
        notes || null
      ]
    );

    await conn.commit();

    res.json({ success: true, message: 'Zakázka zahájena' });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.completeAssembly = async (req, res, next) => {
  const { orderId } = req.params;
  const { operator, notes } = req.body;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      'SELECT assemblyStatus, dateStarted FROM Orders WHERE orderId = ?',
      [orderId]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Zakázka nenalezena' });
    }

    const now = new Date();
    let workDuration = null;
    if (orderRows[0].dateStarted) {
      workDuration = Math.floor((now - orderRows[0].dateStarted) / 60000);
    }

    await conn.query(
      `UPDATE Orders
         SET assemblyStatus = ?, dateCompleted = NOW(), operator = COALESCE(?, operator)
       WHERE orderId = ?` ,
      [ASSEMBLY_STATUS.COMPLETED, operator || null, orderId]
    );

    await conn.query(
      `INSERT INTO AssemblyReports (orderId, reportType, operator, previousStatus, newStatus, workDuration, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)` ,
      [
        orderId,
        REPORT_TYPE.COMPLETE,
        operator || null,
        orderRows[0].assemblyStatus,
        ASSEMBLY_STATUS.COMPLETED,
        workDuration,
        notes || null
      ]
    );

    await conn.commit();

    res.json({ success: true, message: 'Zakázka dokončena', workDurationMinutes: workDuration });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

exports.getAssemblyReport = async (req, res, next) => {
  const { orderId } = req.params;

  try {
    const [orderRows] = await pool.query(
      'SELECT * FROM Orders WHERE orderId = ?',
      [orderId]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Zakázka nenalezena' });
    }

    const order = orderRows[0];

    let workDuration = null;
    if (order.dateStarted && order.dateCompleted) {
      workDuration = Math.floor((order.dateCompleted - order.dateStarted) / 60000);
    }

    const [reports] = await pool.query(
      'SELECT * FROM AssemblyReports WHERE orderId = ? ORDER BY dateCreated DESC',
      [orderId]
    );

    const [quality] = await pool.query(
      'SELECT * FROM QualityChecks WHERE orderId = ? ORDER BY dateChecked DESC',
      [orderId]
    );

    const [auditLog] = await pool.query(
      `SELECT * FROM AuditLog WHERE tableName = 'Orders' AND recordId = ? ORDER BY dateCreated DESC`,
      [orderId]
    );

    const [components] = await pool.query(
      `SELECT oc.*, o.sapNumber AS componentOrderSapNumber, oi.itemName AS componentItemName
         FROM OrderComponents oc
         LEFT JOIN Orders o ON o.orderId = oc.componentOrderId
         LEFT JOIN OrderItems oi ON oi.itemId = oc.componentItemId
         WHERE oc.orderId = ?
         ORDER BY oc.sortOrder, oc.componentId`,
      [orderId]
    );

    res.json({
      success: true,
      data: {
        order,
        timing: {
          dateStarted: order.dateStarted,
          dateCompleted: order.dateCompleted,
          workDurationMinutes: workDuration,
          workDurationHours: workDuration ? (workDuration / 60).toFixed(2) : null
        },
        components,
        reports,
        quality,
        auditLog
      }
    });
  } catch (error) {
    next(error);
  }
};
