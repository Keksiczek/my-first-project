const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const {
  validateWarehouse,
  validateWarehouseId,
  validatePagination
} = require('../middleware/validation');

/**
 * @swagger
 * /api/warehouses:
 *   post:
 *     summary: Vytvoření nového skladu
 *     tags: [Warehouses]
 */
router.post('/', validateWarehouse, warehouseController.createWarehouse);

/**
 * @swagger
 * /api/warehouses:
 *   get:
 *     summary: Přehled skladů
 *     tags: [Warehouses]
 */
router.get('/', validatePagination, warehouseController.getWarehouses);

/**
 * @swagger
 * /api/warehouses/{warehouseId}:
 *   get:
 *     summary: Detail skladu včetně inventáře
 *     tags: [Warehouses]
 */
router.get('/:warehouseId', validateWarehouseId, warehouseController.getWarehouseById);

/**
 * @swagger
 * /api/warehouses/{warehouseId}:
 *   put:
 *     summary: Aktualizace skladu
 *     tags: [Warehouses]
 */
router.put('/:warehouseId', validateWarehouseId, warehouseController.updateWarehouse);

/**
 * @swagger
 * /api/warehouses/{warehouseId}/deactivate:
 *   post:
 *     summary: Deaktivace skladu (pokud je prázdný)
 *     tags: [Warehouses]
 */
router.post('/:warehouseId/deactivate', validateWarehouseId, warehouseController.deactivateWarehouse);

module.exports = router;
