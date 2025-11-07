function parseCsv(csvData) {
  const lines = csvData.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const row = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx];
    });
    rows.push(row);
  }
  return rows;
}

exports.importCsv = async (req, res, next) => {
  const { sapNumber, supplier, csvData } = req.body;

  if (!sapNumber || !supplier || !csvData) {
    return res.status(400).json({
      success: false,
      message: 'sapNumber, supplier a csvData jsou povinné'
    });
  }

  try {
    const parsed = parseCsv(csvData);

    if (parsed.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'CSV neobsahuje žádné položky'
      });
    }

    const items = parsed.map((r) => ({
      itemName: r.itemName,
      quantity: Number(r.quantity) || 0,
      dimension: r.dimension,
      material: r.material,
      position: r.position
    }));

    req.body.items = items;
    return require('./orderController').createOrder(req, res, next);
  } catch (err) {
    next(err);
  }
};
