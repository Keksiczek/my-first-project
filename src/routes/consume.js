const express = require('express');
const router = express.Router();
const movementController = require('../controllers/movementController');
const { validateConsume } = require('../middleware/validation');

/**
 * @swagger
 * /api/consume:
 *   post:
 *     summary: Výdej/spotřeba materiálu
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
 *         description: Materiál vyskladněn
 *       404:
 *         description: Záznam ve skladu nenalezen
 */
router.post('/', validateConsume, movementController.consumeMaterial);

module.exports = router;
