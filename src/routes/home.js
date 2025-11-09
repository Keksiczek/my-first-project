const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

/**
 * @swagger
 * /api/home:
 *   get:
 *     summary: Dashboard – přehled zakázek, skladů, inventáře a kvality
 *     tags: [Home]
 *     responses:
 *       200:
 *         description: Úspěch
 */
router.get('/', homeController.getDashboard);

module.exports = router;
