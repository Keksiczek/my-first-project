const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const { validateCsvImport } = require('../middleware/validation');

/**
 * @swagger
 * /api/import/csv:
 *   post:
 *     summary: Import objednávky z CSV (globální endpoint)
 *     tags: [Import]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sapNumber, supplier, csvData]
 *             properties:
 *               sapNumber:
 *                 type: string
 *               supplier:
 *                 type: string
 *               csvData:
 *                 type: string
 *     responses:
 *       201:
 *         description: Objednávka vytvořena
 *       400:
 *         description: Chyba při importu
 */
router.post('/csv', validateCsvImport, importController.importCsv);

module.exports = router;
