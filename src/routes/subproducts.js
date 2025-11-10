const express = require('express');
const router = express.Router();

const subProductController = require('../controllers/subProductController');
const { resolveUser, authorizeRoles } = require('../middleware/auth');
const {
  validateSubProductCreate,
  validateSubProductList,
  validateSubProductId,
  validateSubProductMove,
  validateWorkOrderParam
} = require('../middleware/subProductValidation');

/**
 * @swagger
 * tags:
 *   - name: SubProducts
 *     description: Správa mezivýrobků a polotovarů
 */

/**
 * @swagger
 * /api/subproducts:
 *   get:
 *     summary: Seznam mezivýrobků
 *     tags: [SubProducts]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: warehouseId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginovaný seznam mezivýrobků
 */
router.get(
  '/',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateSubProductList,
  subProductController.listSubProducts
);

/**
 * @swagger
 * /api/subproducts:
 *   post:
 *     summary: Vytvoření nového mezivýrobku
 *     tags: [SubProducts]
 */
router.post(
  '/',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateSubProductCreate,
  subProductController.createSubProduct
);

/**
 * @swagger
 * /api/subproducts/{subProductId}:
 *   get:
 *     summary: Detail mezivýrobku
 *     tags: [SubProducts]
 */
router.get(
  '/:subProductId',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateSubProductId,
  subProductController.getSubProduct
);

/**
 * @swagger
 * /api/subproducts/{subProductId}/move:
 *   post:
 *     summary: Přesun mezivýrobku
 *     tags: [SubProducts]
 */
router.post(
  '/:subProductId/move',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateSubProductId,
  validateSubProductMove,
  subProductController.moveSubProduct
);

/**
 * @swagger
 * /api/production/{workOrderId}/subproducts:
 *   get:
 *     summary: Přehled mezivýrobků výrobní dávky
 *     tags: [SubProducts]
 */
router.get(
  '/work-order/:workOrderId',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateWorkOrderParam,
  subProductController.getWorkOrderSubProducts
);

module.exports = router;
