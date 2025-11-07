const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const movementController = require('../controllers/movementController');

router.get('/', inventoryController.getInventory);
router.post('/move', movementController.moveMaterial);

module.exports = router;
