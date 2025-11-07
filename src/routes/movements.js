const express = require('express');
const router = express.Router();
const movementController = require('../controllers/movementController');

router.get('/:barcode', movementController.getMovementsByBarcode);

module.exports = router;
