const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const {
  validateWarehouse,
  validateWarehouseId,
  validateWarehouseUpdate,
  validatePagination
} = require('../middleware/validation');
const { requireRole } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   - name: Warehouses
 *     description: Správa skladů a jejich kapacit
 */

/**
 * @swagger
 * /api/warehouses:
 *   post:
 *     summary: Vytvoření nového skladu
 *     tags: [Warehouses]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [warehouseId, warehouseName]
 *             properties:
 *               warehouseId:
 *                 type: string
 *                 maxLength: 50
 *                 example: "SKLAD-C"
 *               warehouseName:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Externí sklad"
 *               location:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Hala 3"
 *               capacity:
 *                 type: integer
 *                 example: 2500
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Sklad byl vytvořen
 *       409:
 *         description: Sklad se zadaným ID již existuje
 */
router.post(
  '/',
  requireRole(['admin']),
  validateWarehouse,
  warehouseController.createWarehouse
);

/**
 * @swagger
 * /api/warehouses:
 *   get:
 *     summary: Přehled skladů
 *     tags: [Warehouses]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Číslo stránky (výchozí 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Počet záznamů na stránku (max 100)
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filtr podle aktivních/neaktivních skladů
 *     responses:
 *       200:
 *         description: Paginovaný seznam skladů
 */
router.get('/', validatePagination, warehouseController.getWarehouses);

/**
 * @swagger
 * /api/warehouses/{warehouseId}:
 *   get:
 *     summary: Detail skladu včetně inventáře
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           maxLength: 50
 *     responses:
 *       200:
 *         description: Detail skladu a seznam materiálu
 *       404:
 *         description: Sklad nenalezen
 */
router.get('/:warehouseId', validateWarehouseId, warehouseController.getWarehouseById);

/**
 * @swagger
 * /api/warehouses/{warehouseId}:
 *   put:
 *     summary: Aktualizace detailů skladu
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           maxLength: 50
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               warehouseName:
 *                 type: string
 *                 maxLength: 255
 *               location:
 *                 type: string
 *                 maxLength: 255
 *               capacity:
 *                 type: integer
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Sklad byl aktualizován
 *       400:
 *         description: Chybí data pro aktualizaci
 *       404:
 *         description: Sklad nenalezen
 */
router.put(
  '/:warehouseId',
  requireRole(['admin']),
  validateWarehouseId,
  validateWarehouseUpdate,
  warehouseController.updateWarehouse
);

/**
 * @swagger
 * /api/warehouses/{warehouseId}/deactivate:
 *   post:
 *     summary: Deaktivace prázdného skladu
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: string
 *           maxLength: 50
 *     responses:
 *       200:
 *         description: Sklad deaktivován
 *       400:
 *         description: Sklad nelze deaktivovat, protože obsahuje materiál
 *       404:
 *         description: Sklad nenalezen
 */
router.post(
  '/:warehouseId/deactivate',
  requireRole(['admin']),
  validateWarehouseId,
  warehouseController.deactivateWarehouse
);

module.exports = router;
