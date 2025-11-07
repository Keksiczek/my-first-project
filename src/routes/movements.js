const express = require('express');
const router = express.Router();
const movementController = require('../controllers/movementController');
const { validatePagination } = require('../middleware/validation');

/**
 * @swagger
 * /api/movements/{barcode}:
 *   get:
 *     summary: Historie pohybů pro čárový kód
 *     tags: [Movements]
 *     parameters:
 *       - in: path
 *         name: barcode
 *         required: true
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
 *         description: Paginovaný seznam pohybů
 */
router.get('/:barcode', validatePagination, movementController.getMovementsByBarcode);

module.exports = router;
