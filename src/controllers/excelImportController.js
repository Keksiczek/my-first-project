const pool = require('../config/db');
const logger = require('../config/logger');
const { parseExcelFile, parseExcelDate } = require('../utils/excelParser');
const { generateOrderQR, generateBarcode } = require('../utils/helpers');
const { ORDER_STATUS, ORDER_TYPE, COMPONENT_TYPE, ITEM_STATUS, ASSEMBLY_STATUS } = require('../constants/statuses');

/**
 * Import objednávek z Excelu
 */
exports.importOrdersFromExcel = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Excel soubor nebyl nahrán'
    });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const rows = parseExcelFile(req.file.buffer);
    logger.info('Import objednávek z Excelu - načtené řádky', { rows: rows.length });

    const createdOrders = [];

    for (const row of rows) {
      const rawSapNumber = (row.RequestTo || row.SapOrderN || '').toString().trim();
      const supplier = (row.Supplier || '').toString().trim();
      const applicant = (row.Applicant || '').toString().trim();
      const deliveryDate = parseExcelDate(row.DeliveryDate);
      const orderDate = parseExcelDate(row.OrderDate) || new Date();

      if (!rawSapNumber || !supplier) {
        logger.warn('Přeskakuji řádek bez SAP čísla nebo dodavatele', { row });
        continue;
      }

      const sapNumber = rawSapNumber.slice(0, 10);

      const [existing] = await conn.query(
        'SELECT orderId FROM Orders WHERE sapNumber = ?',
        [sapNumber]
      );

      if (existing.length > 0) {
        logger.info('Objednávka se SAP číslem již existuje - přeskakuji', { sapNumber });
        continue;
      }

      const orderQR = generateOrderQR(sapNumber);
      const noteParts = [`Objednatel: ${applicant || 'Neuvedeno'}`];
      if (deliveryDate) {
        noteParts.push(`Datum dodání: ${deliveryDate.toISOString().slice(0, 10)}`);
      }
      if (row.Amount) {
        noteParts.push(`Částka: ${row.Amount} ${row.AmountCurrency || ''}`.trim());
      }

      const [result] = await conn.query(
        `INSERT INTO Orders (sapNumber, orderQR, supplier, notes, dateCreated, status, orderType, assemblyStatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sapNumber,
          orderQR,
          supplier,
          noteParts.join(' | '),
          orderDate,
          ORDER_STATUS.PENDING,
          ORDER_TYPE.ZAKAZKA,
          ASSEMBLY_STATUS.PENDING
        ]
      );

      const orderId = result.insertId;
      createdOrders.push({
        orderId,
        sapNumber,
        supplier,
        orderQR,
        applicant
      });

      await conn.query(
        `INSERT INTO AuditLog (tableName, recordId, action, userId, newValue)
         VALUES ('Orders', ?, 'CREATE', NULL, ?)` ,
        [orderId, JSON.stringify({ sapNumber, supplier, source: 'excel-import' })]
      );

      logger.info('Objednávka vytvořena z Excelu', { orderId, sapNumber });
    }

    await conn.commit();

    res.json({
      success: true,
      message: 'Import objednávek dokončen',
      data: {
        ordersCreated: createdOrders.length,
        orders: createdOrders
      }
    });
  } catch (error) {
    await conn.rollback();
    logger.error('Chyba při importu objednávek z Excelu', { error: error.message });
    next(error);
  } finally {
    conn.release();
  }
};

/**
 * Import položek z Excel soupisy
 */
exports.importItemsFromExcel = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Excel soubor nebyl nahrán'
    });
  }

  const { orderId, createAssembly } = req.body;
  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: 'orderId je povinný'
    });
  }

  const shouldCreateAssembly = String(createAssembly || '').toLowerCase() === 'true';

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [orderRows] = await conn.query(
      'SELECT * FROM Orders WHERE orderId = ?',
      [orderId]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        message: 'Objednávka nenalezena'
      });
    }

    const parentOrder = orderRows[0];

    const rows = parseExcelFile(req.file.buffer);
    logger.info('Import soupisy z Excelu - načtené řádky', { rows: rows.length, orderId: Number(orderId) });

    const createdItems = [];
    const createdAssemblies = [];
    let componentSort = 0;

    const ensureUniqueSapNumber = async (baseSapNumber) => {
      let counter = 1;
      let candidate = baseSapNumber;
       
      while (true) {
        const [existing] = await conn.query(
          'SELECT orderId FROM Orders WHERE sapNumber = ?',
          [candidate]
        );
        if (existing.length === 0) {
          return candidate;
        }
        counter += 1;
        candidate = `${baseSapNumber.slice(0, 6)}${String(counter).padStart(2, '0')}`;
      }
    };

    for (const row of rows) {
      const quantity = Number(row.Ks || row.ks || 0) || 1;
      const itemName = (row['Název'] || row.Nazev || '').toString().trim();
      const dimension = (row['Rozměr'] || row.Rozmer || '').toString().trim() || null;
      const materialRaw = (row['Materiál'] || row.Material || '').toString().trim();
      const position = (row.Poz || '').toString().trim() || null;
      const drawingNumber = (row['Poznámka'] || row.Poznamka || '').toString().trim();
      const mirror = (row.Zrc || '').toString().trim();

      if (!itemName) {
        continue;
      }

      const isAssembly = shouldCreateAssembly && materialRaw.toUpperCase() === 'PODSESTAVA';

      if (isAssembly) {
        const baseSapNumber = `PODM${String(createdAssemblies.length + 1).padStart(3, '0')}`.slice(0, 10);
        const sapNumber = await ensureUniqueSapNumber(baseSapNumber);
        const orderQR = generateOrderQR(sapNumber);

        const [assemblyResult] = await conn.query(
          `INSERT INTO Orders (sapNumber, orderQR, supplier, notes, orderType, parentOrderId, status, assemblyStatus)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            sapNumber,
            orderQR,
            parentOrder.supplier,
            `Podmontáž: ${itemName}${drawingNumber ? ` | Výkres: ${drawingNumber}` : ''}`,
            ORDER_TYPE.PODMONTAZ,
            parentOrder.orderId,
            ORDER_STATUS.PENDING,
            ASSEMBLY_STATUS.PENDING
          ]
        );

        const assemblyOrderId = assemblyResult.insertId;

        await conn.query(
          `INSERT INTO OrderComponents (orderId, componentType, componentOrderId, quantityRequired, sortOrder)
           VALUES (?, ?, ?, ?, ?)`,
          [
            parentOrder.orderId,
            COMPONENT_TYPE.ORDER,
            assemblyOrderId,
            quantity,
            componentSort
          ]
        );

        createdAssemblies.push({
          orderId: assemblyOrderId,
          sapNumber,
          orderType: ORDER_TYPE.PODMONTAZ,
          itemName,
          quantity,
          position
        });

        logger.info('Podmontáž vytvořena z Excelu', { assemblyOrderId, parentOrderId: parentOrder.orderId });
      } else {
        const barcode = generateBarcode();
        const [itemResult] = await conn.query(
          `INSERT INTO OrderItems (orderId, barcode, itemName, quantity, dimension, material, position, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            parentOrder.orderId,
            barcode,
            itemName,
            quantity,
            dimension,
            materialRaw || null,
            position,
            ITEM_STATUS.PENDING
          ]
        );

        const itemId = itemResult.insertId;
        createdItems.push({
          itemId,
          barcode,
          itemName,
          quantity,
          dimension,
          material: materialRaw || null,
          position
        });

        logger.info('Položka vytvořena z Excelu', { orderId: parentOrder.orderId, itemId });

        if (mirror) {
          const mirrorBarcode = generateBarcode();
          const [mirrorResult] = await conn.query(
            `INSERT INTO OrderItems (orderId, barcode, itemName, quantity, dimension, material, position, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
            [
              parentOrder.orderId,
              mirrorBarcode,
              `${itemName} (ZRC ${mirror})`,
              quantity,
              dimension,
              materialRaw || null,
              mirror,
              ITEM_STATUS.PENDING
            ]
          );

          createdItems.push({
            itemId: mirrorResult.insertId,
            barcode: mirrorBarcode,
            itemName: `${itemName} (ZRC ${mirror})`,
            quantity,
            dimension,
            material: materialRaw || null,
            position: mirror
          });

          logger.info('Zrcadlená položka vytvořena z Excelu', { orderId: parentOrder.orderId, baseItemId: itemId });
        }
      }

      componentSort += 1;
    }

    await conn.commit();

    res.json({
      success: true,
      message: 'Import soupisy dokončen',
      data: {
        orderId: Number(orderId),
        itemsCreated: createdItems.length,
        assembliesCreated: createdAssemblies.length,
        items: createdItems,
        assemblies: createdAssemblies
      }
    });
  } catch (error) {
    await conn.rollback();
    logger.error('Chyba při importu soupisy z Excelu', { error: error.message });
    next(error);
  } finally {
    conn.release();
  }
};
