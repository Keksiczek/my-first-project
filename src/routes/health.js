const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check API a databáze
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API je v pořádku
 *       503:
 *         description: Služba není dostupná
 */
router.get('/', healthController.healthCheck);

module.exports = router;
