const express = require('express');
const router = express.Router();
const receiveController = require('../controllers/receiveController');
const { validateReceive } = require('../middleware/validation');

/**
 * @swagger
 * /api/receive:
 *   post:
 *     summary: Kompletní příjem položky
 *     tags: [Receive]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [barcode, quantityReceived, warehouseId, position]
 *             properties:
 *               barcode:
 *                 type: string
 *               quantityReceived:
 *                 type: integer
 *               warehouseId:
 *                 type: string
 *               position:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Příjem potvrzen
 *       404:
 *         description: Položka nenalezena
 */
router.post('/', validateReceive, receiveController.receiveFull);

/**
 * @swagger
 * /api/receive/partial:
 *   post:
 *     summary: Částečný příjem položky
 *     tags: [Receive]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [barcode, quantityReceived, warehouseId, position]
 *             properties:
 *               barcode:
 *                 type: string
 *               quantityReceived:
 *                 type: integer
 *               warehouseId:
 *                 type: string
 *               position:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Částečný příjem potvrzen
 *       404:
 *         description: Položka nenalezena
 */
router.post('/partial', validateReceive, receiveController.receivePartial);

module.exports = router;
