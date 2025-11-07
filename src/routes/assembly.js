const express = require('express');
const router = express.Router();
const assemblyController = require('../controllers/assemblyController');

/**
 * @swagger
 * /api/assembly:
 *   post:
 *     summary: Vytvoření nové zakázky nebo podmontáže
 *     tags: [Assembly]
 */
router.post('/', assemblyController.createAssembly);

/**
 * @swagger
 * /api/assembly/{orderId}/components:
 *   post:
 *     summary: Přidání komponenty do zakázky
 *     tags: [Assembly]
 */
router.post('/:orderId/components', assemblyController.addComponentToAssembly);

/**
 * @swagger
 * /api/assembly/components/{componentId}:
 *   delete:
 *     summary: Odstranění komponenty
 *     tags: [Assembly]
 */
router.delete('/components/:componentId', assemblyController.removeComponentFromAssembly);

/**
 * @swagger
 * /api/assembly/{orderId}/tree:
 *   get:
 *     summary: Stromová struktura zakázky
 *     tags: [Assembly]
 */
router.get('/:orderId/tree', assemblyController.getAssemblyTree);

/**
 * @swagger
 * /api/assembly/{orderId}/start:
 *   post:
 *     summary: Zahájení montáže
 *     tags: [Assembly]
 */
router.post('/:orderId/start', assemblyController.startAssembly);

/**
 * @swagger
 * /api/assembly/{orderId}/complete:
 *   post:
 *     summary: Dokončení montáže
 *     tags: [Assembly]
 */
router.post('/:orderId/complete', assemblyController.completeAssembly);

/**
 * @swagger
 * /api/assembly/{orderId}/report:
 *   get:
 *     summary: Report zakázky
 *     tags: [Assembly]
 */
router.get('/:orderId/report', assemblyController.getAssemblyReport);

module.exports = router;
