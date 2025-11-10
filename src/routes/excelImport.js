const express = require('express');
const multer = require('multer');
const excelImportController = require('../controllers/excelImportController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Pouze Excel soubory jsou povoleny (.xlsx, .xls)'));
    }
  }
});

/**
 * @swagger
 * /api/excel-import/orders:
 *   post:
 *     summary: Import objednávek z Excel přehledu
 *     tags: [Excel Import]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: Excel soubor s objednávkami
 *     responses:
 *       200:
 *         description: Import úspěšný
 */
router.post('/orders', upload.single('file'), excelImportController.importOrdersFromExcel);

/**
 * @swagger
 * /api/excel-import/items:
 *   post:
 *     summary: Import soupisy (položek) z Excel rozpisy
 *     tags: [Excel Import]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: Excel soubor se soupiskou
 *       - in: formData
 *         name: orderId
 *         type: integer
 *         required: true
 *         description: ID objednávky
 *       - in: formData
 *         name: createAssembly
 *         type: boolean
 *         description: Vytvořit podmontáže pro položky s materiálem "PODSESTAVA"
 *     responses:
 *       200:
 *         description: Import úspěšný
 */
router.post('/items', upload.single('file'), excelImportController.importItemsFromExcel);

module.exports = router;
