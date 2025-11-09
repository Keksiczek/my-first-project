const express = require('express');
const router = express.Router();
const assemblyController = require('../controllers/assemblyController');
const {
  validateAssemblyCreate,
  validateAssemblyComponent,
  validateComponentId,
  validateOrderId,
  validateAssemblyAction
} = require('../middleware/validation');

/**
 * @swagger
 * tags:
 *   - name: Assembly
 *     description: Správa zakázek a podmontáží ve stromové struktuře
 */

/**
 * @swagger
 * /api/assembly:
 *   post:
 *     summary: Vytvoření nové zakázky nebo podmontáže
 *     tags: [Assembly]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sapNumber, supplier]
 *             properties:
 *               sapNumber:
 *                 type: string
 *                 example: "ZAK-2025001"
 *               supplier:
 *                 type: string
 *                 example: "Zákazník A"
 *               orderType:
 *                 type: string
 *                 enum: [zakazka, podmontaz]
 *                 default: zakazka
 *               parentOrderId:
 *                 type: integer
 *                 description: ID nadřazené zakázky, pokud jde o podmontáž
 *               notes:
 *                 type: string
 *               operator:
 *                 type: string
 *     responses:
 *       201:
 *         description: Zakázka vytvořena
 *       409:
 *         description: SAP číslo již existuje
 */
router.post('/', validateAssemblyCreate, assemblyController.createAssembly);

/**
 * @swagger
 * /api/assembly/{orderId}/components:
 *   post:
 *     summary: Přidání komponenty do zakázky
 *     tags: [Assembly]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [componentType]
 *             properties:
 *               componentType:
 *                 type: string
 *                 enum: [order, item]
 *               componentOrderId:
 *                 type: integer
 *                 description: Povinné pro komponentu typu order
 *               componentItemId:
 *                 type: integer
 *                 description: Povinné pro komponentu typu item
 *               quantityRequired:
 *                 type: integer
 *                 default: 1
 *               sortOrder:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       201:
 *         description: Komponenta přidána
 *       404:
 *         description: Zakázka nebo komponenta nenalezena
 */
router.post(
  '/:orderId/components',
  validateAssemblyComponent,
  assemblyController.addComponentToAssembly
);

/**
 * @swagger
 * /api/assembly/components/{componentId}:
 *   delete:
 *     summary: Odstranění komponenty ze zakázky
 *     tags: [Assembly]
 *     parameters:
 *       - in: path
 *         name: componentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Komponenta odstraněna
 *       404:
 *         description: Komponenta nenalezena
 */
router.delete(
  '/components/:componentId',
  validateComponentId,
  assemblyController.removeComponentFromAssembly
);

/**
 * @swagger
 * /api/assembly/{orderId}/tree:
 *   get:
 *     summary: Stromová struktura zakázky včetně všech podmontáží
 *     tags: [Assembly]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Úspěšné načtení stromu
 *       404:
 *         description: Zakázka nenalezena
 */
router.get('/:orderId/tree', validateOrderId, assemblyController.getAssemblyTree);

/**
 * @swagger
 * /api/assembly/{orderId}/start:
 *   post:
 *     summary: Zahájení montáže zakázky
 *     tags: [Assembly]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operator:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Zakázka zahájena
 *       400:
 *         description: Zakázku nelze zahájit v aktuálním stavu
 *       404:
 *         description: Zakázka nenalezena
 */
router.post(
  '/:orderId/start',
  validateAssemblyAction,
  assemblyController.startAssembly
);

/**
 * @swagger
 * /api/assembly/{orderId}/complete:
 *   post:
 *     summary: Dokončení montáže zakázky
 *     tags: [Assembly]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operator:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Zakázka dokončena
 *       400:
 *         description: Zakázku nelze dokončit v aktuálním stavu
 *       404:
 *         description: Zakázka nenalezena
 */
router.post(
  '/:orderId/complete',
  validateAssemblyAction,
  assemblyController.completeAssembly
);

/**
 * @swagger
 * /api/assembly/{orderId}/report:
 *   get:
 *     summary: Detailní report zakázky včetně historie a komponent
 *     tags: [Assembly]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Report zakázky
 *       404:
 *         description: Zakázka nenalezena
 */
router.get('/:orderId/report', validateOrderId, assemblyController.getAssemblyReport);

module.exports = router;
