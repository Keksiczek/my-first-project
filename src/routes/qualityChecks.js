const express = require('express');
const router = express.Router();

const qualityCheckController = require('../controllers/qualityCheckController');
const { resolveUser, authorizeRoles } = require('../middleware/auth');
const {
  validateQualityCreate,
  validateQualityQuery,
  validateQualityId,
  validateStageParam
} = require('../middleware/qualityValidation');

/**
 * @swagger
 * tags:
 *   - name: ProductionQuality
 *     description: Kontroly kvality ve výrobních mezioperacích
 */

/**
 * @swagger
 * /api/quality-checks:
 *   post:
 *     summary: Založení kontroly kvality
 *     tags: [ProductionQuality]
 */
router.post(
  '/',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateQualityCreate,
  qualityCheckController.createQualityCheck
);

/**
 * @swagger
 * /api/quality-checks:
 *   get:
 *     summary: Seznam kontrol kvality
 *     tags: [ProductionQuality]
 */
router.get(
  '/',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateQualityQuery,
  qualityCheckController.listQualityChecks
);

/**
 * @swagger
 * /api/quality-checks/{checkId}:
 *   put:
 *     summary: Aktualizace záznamu kontroly
 *     tags: [ProductionQuality]
 */
router.put(
  '/:checkId',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateQualityId,
  qualityCheckController.updateQualityCheck
);

/**
 * @swagger
 * /api/quality-checks/{stageId}:
 *   get:
 *     summary: Kontroly kvality pro mezioperaci
 *     tags: [ProductionQuality]
 */
router.get(
  '/stage/:stageId',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  validateStageParam,
  qualityCheckController.getStageQualityChecks
);

/**
 * @swagger
 * /api/quality-checks/report:
 *   get:
 *     summary: Souhrnný report kvality
 *     tags: [ProductionQuality]
 */
router.get(
  '/report',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  qualityCheckController.getQualityReport
);

module.exports = router;
