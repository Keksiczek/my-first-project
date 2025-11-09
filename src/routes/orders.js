const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireRole } = require('../middleware/auth');
const {
  validateCreateOrder,
  validateOrderId,
  validatePagination,
  validateUpdateOrder,
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
router.post(
  '/create',
  requireRole(['admin', 'operator']),
  validateCreateOrder,
  orderController.createOrder
);

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
 * /api/orders/{orderId}:
 *   put:
 *     summary: Aktualizace objednávky
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               supplier:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Objednávka aktualizována
 *       400:
 *         description: Není co aktualizovat
 *       404:
 *         description: Objednávka nenalezena
 */
router.put(
  '/:orderId',
  requireRole(['admin', 'operator']),
  validateOrderId,
  validateUpdateOrder,
  orderController.updateOrder
);

/**
 * @swagger
 * /api/orders/{orderId}:
 *   delete:
 *     summary: Smazání objednávky
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Objednávka smazána
 *       400:
 *         description: Objednávka má již přijatý materiál
 *       404:
 *         description: Objednávka nenalezena
 */
router.delete(
  '/:orderId',
  requireRole(['admin']),
  validateOrderId,
  orderController.deleteOrder
);

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
router.post(
  '/generate-barcodes',
  requireRole(['admin', 'operator']),
  validateGenerateBarcodes,
  orderController.generateBarcodes
);

module.exports = router;
