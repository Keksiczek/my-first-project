const express = require('express');
const router = express.Router();

const exportController = require('../controllers/exportController');
const { resolveUser, authorizeRoles } = require('../middleware/auth');
const { validateCustomExport } = require('../middleware/exportValidation');

/**
 * @swagger
 * tags:
 *   - name: Exports
 *     description: Exporty dat a reporting
 */

router.get(
  '/inventory',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  exportController.exportInventory
);

router.get(
  '/production-report',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  exportController.exportProductionReport
);

router.get(
  '/traceability',
  resolveUser,
  authorizeRoles('admin', 'operator', 'operator_limited', 'viewer'),
  exportController.exportTraceability
);

router.post(
  '/custom',
  resolveUser,
  authorizeRoles('admin', 'operator'),
  validateCustomExport,
  exportController.customExport
);

module.exports = router;
