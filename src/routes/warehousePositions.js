const express = require('express');
const router = express.Router();

const warehouseController = require('../controllers/warehouseController');
const { resolveUser, authorizeRoles } = require('../middleware/auth');
const {
  validateWarehousePositionCreate,
  validateWarehousePositionQuery
} = require('../middleware/warehouseValidation');

/**
 * @swagger
 * tags:
 *   - name: WarehousePositions
 *     description: Správa skladových pozic napříč sklady
 */

/**
 * @swagger
 * /api/warehouse-positions:
 *   get:
 *     summary: Seznam všech skladových pozic
 *     tags: [WarehousePositions]
 *     parameters:
 *       - in: query
 *         name: warehouseId
 *         schema:
 *           type: integer
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
 *         description: Paginovaný seznam pozic
 */
router.get(
  '/',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateWarehousePositionQuery,
  warehouseController.getWarehousePositions
);

/**
 * @swagger
 * /api/warehouse-positions:
 *   post:
 *     summary: Vytvoření nové skladové pozice
 *     tags: [WarehousePositions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [warehouseId, positionName]
 *             properties:
 *               warehouseId:
 *                 type: integer
 *               positionName:
 *                 type: string
 *               description:
 *                 type: string
 *               maxCapacity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Pozice vytvořena
 *       409:
 *         description: Pozice již existuje
 */
router.post(
  '/',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateWarehousePositionCreate,
  warehouseController.createWarehousePosition
);

/**
 * @swagger
 * /api/warehouse-positions/vacant:
 *   get:
 *     summary: Výpis volných skladových pozic
 *     tags: [WarehousePositions]
 *     responses:
 *       200:
 *         description: Přehled volných pozic
 */
router.get(
  '/vacant',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  warehouseController.getVacantPositions
);

module.exports = router;
