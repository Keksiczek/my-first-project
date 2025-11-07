const express = require('express');
const router = express.Router();
const qualityController = require('../controllers/qualityController');

/**
 * @swagger
 * /api/quality/{orderId}:
 *   post:
 *     summary: Zapsání kontroly kvality
 *     tags: [Quality]
 */
router.post('/:orderId', qualityController.performQualityCheck);

/**
 * @swagger
 * /api/quality/{orderId}/history:
 *   get:
 *     summary: Historie kontrol kvality
 *     tags: [Quality]
 */
router.get('/:orderId/history', qualityController.getQualityHistory);

module.exports = router;
