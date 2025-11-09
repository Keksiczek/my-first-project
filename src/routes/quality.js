const express = require('express');
const router = express.Router();
const qualityController = require('../controllers/qualityController');
const { validateQualityCheck, validateOrderId } = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   - name: Quality
 *     description: Evidence kontrol kvality
 */

/**
 * @swagger
 * /api/quality/{orderId}:
 *   post:
 *     summary: Zapsání výsledku kontroly kvality
 *     tags: [Quality]
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
 *             required: [result, inspector]
 *             properties:
 *               result:
 *                 type: string
 *                 enum: [OK, NOK]
 *               inspector:
 *                 type: string
 *               notes:
 *                 type: string
 *               parameters:
 *                 type: object
 *                 description: Dodatečné parametry měření
 *     responses:
 *       200:
 *         description: Kontrola byla uložena
 *       404:
 *         description: Zakázka nenalezena
 */
router.post('/:orderId', validateQualityCheck, qualityController.performQualityCheck);

/**
 * @swagger
 * /api/quality/{orderId}/history:
 *   get:
 *     summary: Historie všech kontrol kvality pro zakázku
 *     tags: [Quality]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Přehled kontrol
 *       404:
 *         description: Zakázka nenalezena
 */
router.get('/:orderId/history', validateOrderId, qualityController.getQualityHistory);

module.exports = router;
