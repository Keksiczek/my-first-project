const express = require('express');
const router = express.Router();

const productionController = require('../controllers/productionController');
const productionStageController = require('../controllers/productionStageController');
const subProductController = require('../controllers/subProductController');
const { resolveUser, authorizeRoles } = require('../middleware/auth');
const { validateWorkOrderParam } = require('../middleware/subProductValidation');
const {
  validateProductionStart,
  validateProductionQuery,
  validateProductionId,
  validateProductionUpdate,
  validateStageId,
  validateStageAction
} = require('../middleware/productionValidation');

/**
 * @swagger
 * tags:
 *   - name: Production
 *     description: Správa výrobních dávek
 *   - name: ProductionStages
 *     description: Řízení mezioperací ve výrobě
 */

/**
 * @swagger
 * /api/production/start:
 *   post:
 *     summary: Zahájení nové výrobní dávky
 *     tags: [Production]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productCode, quantityIn]
 *             properties:
 *               productCode:
 *                 type: string
 *               quantityIn:
 *                 type: integer
 *               orderId:
 *                 type: integer
 *               stages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     stageName:
 *                       type: string
 *                     stageSequence:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Výrobní dávka vytvořena
 */
router.post(
  '/start',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateProductionStart,
  productionController.startProduction
);

/**
 * @swagger
 * /api/production:
 *   get:
 *     summary: Seznam výrobních dávek
 *     tags: [Production]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: productCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: batchNumber
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginovaný seznam výrobních dávek
 */
router.get(
  '/',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateProductionQuery,
  productionController.listProduction
);

/**
 * @swagger
 * /api/production/{workOrderId}:
 *   get:
 *     summary: Detail výrobní dávky
 *     tags: [Production]
 *     parameters:
 *       - in: path
 *         name: workOrderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detail dávky včetně mezioperací
 */
router.get(
  '/:workOrderId/subproducts',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateWorkOrderParam,
  subProductController.getWorkOrderSubProducts
);

router.get(
  '/:workOrderId',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateProductionId,
  productionController.getProductionDetail
);

/**
 * @swagger
 * /api/production/{workOrderId}:
 *   put:
 *     summary: Aktualizace výrobní dávky
 *     tags: [Production]
 *     parameters:
 *       - in: path
 *         name: workOrderId
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
 *               status:
 *                 type: string
 *               quantityOut:
 *                 type: integer
 *               quantityScrap:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Výrobní dávka aktualizována
 */
router.put(
  '/:workOrderId',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateProductionId,
  validateProductionUpdate,
  productionController.updateProduction
);

/**
 * @swagger
 * /api/production/stage/{stageId}/start:
 *   post:
 *     summary: Zahájení mezioperace
 *     tags: [ProductionStages]
 */
router.post(
  '/stage/:stageId/start',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateStageId,
  validateStageAction,
  productionStageController.startStage
);

/**
 * @swagger
 * /api/production/stage/{stageId}/pause:
 *   post:
 *     summary: Pozastavení mezioperace
 *     tags: [ProductionStages]
 */
router.post(
  '/stage/:stageId/pause',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateStageId,
  validateStageAction,
  productionStageController.pauseStage
);

/**
 * @swagger
 * /api/production/stage/{stageId}/resume:
 *   post:
 *     summary: Obnovení mezioperace
 *     tags: [ProductionStages]
 */
router.post(
  '/stage/:stageId/resume',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateStageId,
  validateStageAction,
  productionStageController.resumeStage
);

/**
 * @swagger
 * /api/production/stage/{stageId}/complete:
 *   post:
 *     summary: Dokončení mezioperace
 *     tags: [ProductionStages]
 */
router.post(
  '/stage/:stageId/complete',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateStageId,
  validateStageAction,
  productionStageController.completeStage
);

/**
 * @swagger
 * /api/production/stage/{stageId}:
 *   get:
 *     summary: Detail mezioperace
 *     tags: [ProductionStages]
 */
router.get(
  '/stage/:stageId',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateStageId,
  productionStageController.getStageDetail
);

/**
 * @swagger
 * /api/production/stage/{stageId}/logs:
 *   get:
 *     summary: Logy mezioperace
 *     tags: [ProductionStages]
 */
router.get(
  '/stage/:stageId/logs',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateStageId,
  productionStageController.getStageLogs
);

module.exports = router;
