const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const movementController = require('../controllers/movementController');
const { validateMove, validatePagination } = require('../middleware/validation');

/**
 * @swagger
 * /api/inventory:
 *   get:
 *     summary: Přehled zásob ve skladu
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: warehouse
 *         schema:
 *           type: string
 *       - in: query
 *         name: barcode
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
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
 *         description: Paginovaný seznam zásob
 */
router.get('/', validatePagination, inventoryController.getInventory);

/**
 * @swagger
 * /api/inventory/move:
 *   post:
 *     summary: Přesunutí materiálu na pozici
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [barcode, warehouseId, position, quantity]
 *             properties:
 *               barcode:
 *                 type: string
 *               warehouseId:
 *                 type: string
 *               position:
 *                 type: string
 *               quantity:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Přesun zaznamenán
 *       404:
 *         description: Položka nenalezena
 */
router.post('/move', validateMove, movementController.moveMaterial);

module.exports = router;
