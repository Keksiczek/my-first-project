const express = require('express');
const router = express.Router();

const warehouseController = require('../controllers/warehouseController');
const { resolveUser, authorizeRoles } = require('../middleware/auth');
const {
  validateWarehouseCreate,
  validateWarehouseUpdate,
  validateWarehouseIdParam,
  validateWarehouseListQuery
} = require('../middleware/warehouseValidation');

/**
 * @swagger
 * tags:
 *   - name: Warehouses
 *     description: Správa skladů a jejich kapacit
 */

/**
 * @swagger
 * /api/warehouses:
 *   get:
 *     summary: Přehled všech skladů s agregovanou kapacitou
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [Main, Buffer, WIP, Finished]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginovaný seznam skladů
 */
router.get(
  '/',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateWarehouseListQuery,
  warehouseController.getWarehouses
);

/**
 * @swagger
 * /api/warehouses/{warehouseId}:
 *   get:
 *     summary: Detail skladu včetně pozic a inventáře
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detail skladu
 *       404:
 *         description: Sklad nenalezen
 */
router.get(
  '/:warehouseId',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateWarehouseIdParam,
  warehouseController.getWarehouseById
);

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
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [Main, Buffer, WIP, Finished]
 *               location:
 *                 type: string
 *               capacity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Sklad byl vytvořen
 *       409:
 *         description: Duplicitní záznam
 */
router.post(
  '/',
  resolveUser,
  authorizeRoles('admin'),
  validateWarehouseCreate,
  warehouseController.createWarehouse
);

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
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [Main, Buffer, WIP, Finished]
 *               location:
 *                 type: string
 *               capacity:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Sklad aktualizován
 *       400:
 *         description: Neplatná data
 *       404:
 *         description: Sklad nenalezen
 */
router.put(
  '/:warehouseId',
  resolveUser,
  authorizeRoles('admin'),
  validateWarehouseIdParam,
  validateWarehouseUpdate,
  warehouseController.updateWarehouse
);

/**
 * @swagger
 * /api/warehouses/{warehouseId}:
 *   delete:
 *     summary: Deaktivace skladu bez zásob
 *     tags: [Warehouses]
 *     parameters:
 *       - in: path
 *         name: warehouseId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Sklad deaktivován
 *       400:
 *         description: Sklad obsahuje zásoby
 *       404:
 *         description: Sklad nenalezen
 */
router.delete(
  '/:warehouseId',
  resolveUser,
  authorizeRoles('admin'),
  validateWarehouseIdParam,
  warehouseController.deactivateWarehouse
);

module.exports = router;
