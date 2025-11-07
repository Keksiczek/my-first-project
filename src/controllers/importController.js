const { parse } = require('csv-parse/sync');

function parseCsv (csvData) {
  try {
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      delimiter: [',', ';', '\t'],
      relax_quotes: true,
      relax_column_count: true
    });

    const requiredColumns = ['itemName', 'quantity', 'dimension', 'material', 'position'];
    if (records.length > 0) {
      const firstRow = records[0];
      const missing = requiredColumns.filter((col) => !(col in firstRow));
      if (missing.length > 0) {
        throw new Error(`CSV chybí sloupce: ${missing.join(', ')}`);
      }
    }

    return records;
  } catch (error) {
    throw new Error(`Chyba při parsování CSV: ${error.message}`);
  }
}

exports.importCsv = async (req, res, next) => {
  const { sapNumber, supplier, csvData } = req.body;

  try {
    const parsed = parseCsv(csvData);

    if (parsed.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV neobsahuje žádné položky'
      });
    }

    const items = parsed.map((row, index) => {
      const quantity = parseInt(row.quantity, 10);
      if (Number.isNaN(quantity) || quantity <= 0) {
        throw new Error(`Řádek ${index + 2}: Neplatné množství "${row.quantity}"`);
      }
      if (!row.itemName || row.itemName.trim() === '') {
        throw new Error(`Řádek ${index + 2}: Chybí název položky`);
      }

      return {
        itemName: row.itemName.trim(),
        quantity,
        dimension: row.dimension ? row.dimension.trim() : null,
        material: row.material ? row.material.trim() : null,
        position: row.position ? row.position.trim() : null
      };
    });

    req.body.items = items;
    return require('./orderController').createOrder(req, res, next);
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
