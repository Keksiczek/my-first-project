const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const importController = require('../controllers/importController');
const {
  validateCreateOrder,
  validateOrderId,
  validatePagination,
  validateCsvImport,
  validateGenerateBarcodes
} = require('../middleware/validation');

/**
 * @swagger
 * /api/orders/create:
 *   post:
 *     summary: Vytvoření nové objednávky
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sapNumber, supplier, items]
 *             properties:
 *               sapNumber:
 *                 type: string
 *                 example: "4500123456"
 *               supplier:
 *                 type: string
 *                 example: "Kovar s.r.o."
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemName:
 *                       type: string
 *                     quantity:
 *                       type: integer
 *                     dimension:
 *                       type: string
 *                     material:
 *                       type: string
 *                     position:
 *                       type: string
 *     responses:
 *       201:
 *         description: Objednávka vytvořena
 *       400:
 *         description: Validační chyba
 */
router.post('/create', validateCreateOrder, orderController.createOrder);

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: Seznam objednávek
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, partial, complete]
 *       - in: query
 *         name: supplier
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginovaný seznam objednávek
 */
router.get('/', validatePagination, orderController.getOrders);

/**
 * @swagger
 * /api/orders/qr/{orderQR}:
 *   get:
 *     summary: Detail objednávky podle QR kódu
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderQR
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail objednávky
 *       404:
 *         description: Objednávka nenalezena
 */
router.get('/qr/:orderQR', orderController.getOrderByQR);

/**
 * @swagger
 * /api/orders/{orderId}:
 *   get:
 *     summary: Detail objednávky
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detail objednávky
 *       404:
 *         description: Objednávka nenalezena
 */
router.get('/:orderId', validateOrderId, orderController.getOrderById);

/**
 * @swagger
 * /api/orders/generate-barcodes:
 *   post:
 *     summary: Seznam čárových kódů pro tisk
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Seznam kódů
 *       404:
 *         description: Objednávka nemá položky
 */
router.post('/generate-barcodes', validateGenerateBarcodes, orderController.generateBarcodes);

/**
 * @swagger
 * /api/import/csv:
 *   post:
 *     summary: Import objednávky z CSV
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
 *                 description: CSV data jako text
 *     responses:
 *       201:
 *         description: Objednávka vytvořena
 *       400:
 *         description: Chyba při importu
 */
router.post('/import/csv', validateCsvImport, importController.importCsv);

module.exports = router;
